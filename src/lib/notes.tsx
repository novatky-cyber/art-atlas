import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, type Checkin, type JobRun, type Note } from './supabase';
import { useAuth } from './auth';
import { compressImage } from './image';
import { PHOTO_BUCKET } from './config';

const ACTIVE_KEY = 'art-atlas:active-checkin';
const CHECKIN_TTL_MS = 12 * 60 * 60 * 1000;

export interface ActiveCheckin {
  id: string;
  museum_name: string;
  museum_ref: string | null;
  started_at: string;
}

interface NotesApi {
  loading: boolean;
  error: string | null;
  notes: Note[];
  seen: Set<string>;
  lastJob: JobRun | null;
  active: ActiveCheckin | null;
  reload: () => Promise<void>;
  save: (n: Partial<Note> & { id: string }, files?: { photos?: File[]; plates?: File[] }) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  removePhoto: (note: Note, path: string, field: 'photos' | 'plate_photos') => Promise<void>;
  checkIn: (museum_name: string, museum_ref: string | null, lat?: number, lng?: number) => Promise<void>;
  checkOut: () => Promise<void>;
  photoUrl: (path: string) => string | undefined;
  loadPhotoUrls: (paths: string[]) => Promise<void>;
  pins: (artworkId: string) => Promise<{ x: number; y: number }[] | null>;
  savePins: (artworkId: string, positions: { x: number; y: number }[]) => Promise<void>;
}

const Ctx = createContext<NotesApi | null>(null);

function readActive(): ActiveCheckin | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') as ActiveCheckin | null;
    if (a && Date.now() - new Date(a.started_at).getTime() < CHECKIN_TTL_MS) return a;
  } catch {
    /* 読めなければチェックインなし */
  }
  return null;
}
function writeActive(a: ActiveCheckin | null) {
  try {
    if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* 保存できなくても続行 */
  }
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function NotesProvider({ children }: { children: ReactNode }) {
  const { session, owner } = useAuth();
  const uid = session?.user.id;
  const [notes, setNotes] = useState<Note[]>([]);
  const [lastJob, setLastJob] = useState<JobRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveCheckin | null>(readActive);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!uid || !owner) return;
    setLoading(true);
    const [n, j] = await Promise.all([
      supabase.from('notes').select('*').order('visited_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('job_runs').select('id,kind,status,summary,created_at').order('created_at', { ascending: false }).limit(1),
    ]);
    if (n.error) setError(n.error.message);
    else {
      setError(null);
      setNotes(n.data as Note[]);
    }
    setLastJob((j.data?.[0] as JobRun) ?? null);
    setLoading(false);
  }, [uid, owner]);

  useEffect(() => {
    if (owner) reload();
    else setNotes([]);
  }, [owner, reload]);

  const upload = async (noteId: string, files: File[]) => {
    const paths: string[] = [];
    for (const f of files) {
      const blob = await compressImage(f);
      const path = `${uid}/${noteId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (e) throw new Error('写真のアップロードに失敗しました：' + e.message);
      paths.push(path);
    }
    return paths;
  };

  const save: NotesApi['save'] = async (n, files) => {
    if (!uid) throw new Error('ログインが必要です');
    const existing = notes.find((x) => x.id === n.id);
    const photos = [...(n.photos ?? existing?.photos ?? []), ...(files?.photos?.length ? await upload(n.id, files.photos) : [])];
    const plates = [...(n.plate_photos ?? existing?.plate_photos ?? []), ...(files?.plates?.length ? await upload(n.id, files.plates) : [])];
    const row = { ...n, photos, plate_photos: plates };
    delete (row as Partial<Note>).created_at;
    delete (row as Partial<Note>).updated_at;
    const { data, error: e } = await supabase.from('notes').upsert(row).select().single();
    if (e) throw new Error('保存に失敗しました：' + e.message);
    const saved = data as Note;
    setNotes((list) => [saved, ...list.filter((x) => x.id !== saved.id)].sort((a, b) => b.visited_on.localeCompare(a.visited_on) || b.created_at.localeCompare(a.created_at)));
    return saved;
  };

  const remove = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    const files = [...(n?.photos ?? []), ...(n?.plate_photos ?? [])];
    if (files.length) await supabase.storage.from(PHOTO_BUCKET).remove(files);
    const { error: e } = await supabase.from('notes').delete().eq('id', id);
    if (e) throw new Error(e.message);
    setNotes((list) => list.filter((x) => x.id !== id));
  };

  const removePhoto: NotesApi['removePhoto'] = async (note, path, field) => {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    await save({ id: note.id, [field]: note[field].filter((p) => p !== path) });
  };

  const checkIn: NotesApi['checkIn'] = async (museum_name, museum_ref, lat, lng) => {
    const { data, error: e } = await supabase
      .from('checkins')
      .insert({ museum_name, museum_ref, lat: lat ?? null, lng: lng ?? null })
      .select()
      .single();
    if (e) throw new Error('チェックインに失敗しました：' + e.message);
    const c = data as Checkin;
    const a = { id: c.id, museum_name: c.museum_name, museum_ref: c.museum_ref, started_at: c.started_at };
    writeActive(a);
    setActive(a);
  };

  const checkOut = async () => {
    if (active) await supabase.from('checkins').update({ ended_at: new Date().toISOString() }).eq('id', active.id);
    writeActive(null);
    setActive(null);
  };

  const loadPhotoUrls = useCallback(async (paths: string[]) => {
    const need = paths.filter((p) => !urls[p]);
    if (!need.length) return;
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need, 60 * 60);
    if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string])) }));
  }, [urls]);

  const pins = async (artworkId: string) => {
    if (!owner) return null;
    const { data } = await supabase.from('pin_positions').select('positions').eq('artwork_id', artworkId).maybeSingle();
    return (data?.positions as { x: number; y: number }[]) ?? null;
  };
  const savePins = async (artworkId: string, positions: { x: number; y: number }[]) => {
    const { error: e } = await supabase.from('pin_positions').upsert({ artwork_id: artworkId, positions, updated_at: new Date().toISOString() });
    if (e) throw new Error(e.message);
  };

  const seen = useMemo(() => new Set(notes.map((n) => n.artwork_id).filter(Boolean) as string[]), [notes]);

  return (
    <Ctx.Provider
      value={{ loading, error, notes, seen, lastJob, active, reload, save, remove, removePhoto, checkIn, checkOut, photoUrl: (p) => urls[p], loadPhotoUrls, pins, savePins }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotes() {
  const c = useContext(Ctx);
  if (!c) throw new Error('NotesProvider がありません');
  return c;
}
