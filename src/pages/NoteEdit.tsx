import { useEffect, useMemo, useRef, useState } from 'react';
import { displayTitle, useDb } from '../lib/data';
import { href } from '../lib/router';
import { useAuth } from '../lib/auth';
import { todayStr, useNotes } from '../lib/notes';
import { MOODS } from '../lib/config';
import type { Note } from '../lib/supabase';
import { Stars } from '../components/Stars';
import { Photo } from '../components/Photo';
import { ArtImage } from '../components/ArtImage';

const STATUS_LABEL = { pending: '解説待ち', review: '要確認', done: '完成' } as const;

export function NoteEdit({ id, query }: { id: string; query: URLSearchParams }) {
  const db = useDb();
  const { owner } = useAuth();
  const n = useNotes();
  const isNew = id === 'new';
  const quick = isNew && query.get('quick') === '1';
  const existing = n.notes.find((x) => x.id === id);
  const [noteId] = useState(() => (isNew ? crypto.randomUUID() : id));

  const initial = useMemo<Partial<Note>>(
    () =>
      existing ?? {
        artwork_id: query.get('artwork'),
        visited_on: todayStr(),
        museum_name: n.active?.museum_name ?? null,
        museum_ref: n.active?.museum_ref ?? null,
        checkin_id: n.active?.id ?? null,
        moods: [],
        photos: [],
        plate_photos: [],
        rating: null,
        comment: '',
        title_memo: '',
        artist_memo: '',
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing?.id],
  );
  const [form, setForm] = useState<Partial<Note>>(initial);
  useEffect(() => setForm(initial), [initial]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [plates, setPlates] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (p: Partial<Note>) => setForm((f) => ({ ...f, ...p }));
  const photoIn = useRef<HTMLInputElement>(null);
  const plateIn = useRef<HTMLInputElement>(null);

  if (!owner) return <div className="page empty">ログインが必要です。<a href="#/">手帳へ</a></div>;
  if (!isNew && !existing) return <div className="page empty">{n.loading ? '読み込み中…' : '記録が見つかりません。'}</div>;

  const a = form.artwork_id ? db.art[form.artwork_id] : null;
  const hasPlate = (form.plate_photos?.length ?? 0) + plates.length > 0;
  const status: Note['status'] = a ? 'done' : quick || hasPlate ? 'pending' : existing?.status ?? 'done';

  const submit = async () => {
    if (quick && !photos.length && !plates.length) {
      setMsg('作品か解説プレートの写真を1枚以上撮ってください');
      return;
    }
    setBusy(true);
    setMsg(photos.length + plates.length ? '写真を縮小してアップロードしています…' : '保存しています…');
    try {
      const saved = await n.save(
        {
          id: noteId,
          artwork_id: form.artwork_id ?? null,
          status: existing && !a && !plates.length ? existing.status : status,
          title_memo: form.title_memo || null,
          artist_memo: form.artist_memo || null,
          museum_name: form.museum_name || null,
          museum_ref: form.museum_ref ?? null,
          checkin_id: form.checkin_id ?? null,
          visited_on: form.visited_on || todayStr(),
          comment: form.comment || null,
          rating: form.rating ?? null,
          moods: form.moods ?? [],
          photos: form.photos ?? [],
          plate_photos: form.plate_photos ?? [],
        },
        { photos, plates },
      );
      location.hash = href('note', saved.id).slice(1);
      setPhotos([]);
      setPlates([]);
      setMsg('保存しました');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };

  const confirmCandidate = async (c: NonNullable<NonNullable<Note['ai_result']>['candidates']>[number]) => {
    if (!existing) return;
    setBusy(true);
    try {
      if (c.artwork_id && db.art[c.artwork_id]) {
        await n.save({ id: existing.id, artwork_id: c.artwork_id, status: 'done', ai_result: { ...existing.ai_result, confirmed: c } });
      } else {
        // DB にない候補：今夜の処理でこの内容をもとに作品ページを作る
        await n.save({ id: existing.id, status: 'pending', title_memo: c.title, artist_memo: c.artist ?? existing.artist_memo, ai_result: { ...existing.ai_result, confirmed: c } });
      }
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="page note-edit">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <h1>{quick ? 'クイック登録' : isNew ? '記録する' : '記録'}</h1>
      {existing && <span className={`status ${existing.status}`}>{STATUS_LABEL[existing.status]}</span>}

      {a && (
        <a className="note-art" href={href('a', a.id)}>
          <ArtImage a={a} />
          <div>
            <strong>{displayTitle(a)}</strong>
            <div className="small muted">{a.facts.artist ?? ''}</div>
          </div>
        </a>
      )}

      {existing?.status === 'review' && existing.ai_result?.candidates?.length ? (
        <section className="panel">
          <h2>どの作品ですか？</h2>
          <p className="small muted">{existing.ai_result.message ?? 'プレートの読み取りに自信がありません。候補をタップして確定してください。'}</p>
          {existing.ai_result.candidates.map((c, i) => (
            <button key={i} className="option" disabled={busy} onClick={() => confirmCandidate(c)}>
              <strong>{c.title}</strong> {c.artist && <span className="small muted">／{c.artist}</span>}
              {c.artwork_id && db.art[c.artwork_id] && <span className="tiny tag">図鑑にあり</span>}
              {c.note && <div className="tiny muted">{c.note}</div>}
            </button>
          ))}
          <p className="tiny muted">どれも違う場合は、下の作品名メモを直して保存すると、次の夜にもう一度解説を試みます。</p>
        </section>
      ) : null}

      {existing?.status === 'pending' && <p className="small muted">今夜の自動処理で、写真から作品を特定して解説ページを作ります。</p>}

      <div className="form">
        {!a && (
          <>
            <label>作品名メモ{quick && '（任意）'}</label>
            <input value={form.title_memo ?? ''} onChange={(e) => set({ title_memo: e.target.value })} placeholder="わかれば" />
            {!quick && (
              <>
                <label>作家</label>
                <input value={form.artist_memo ?? ''} onChange={(e) => set({ artist_memo: e.target.value })} />
              </>
            )}
          </>
        )}

        <label>{quick ? '作品の写真' : '自分の写真（複数可）'}</label>
        <div className="photo-row">
          {form.photos?.map((p) => (
            <div key={p} className="thumb-wrap">
              <Photo path={p} className="thumb" />
              {existing && <button className="x" onClick={() => n.removePhoto(existing, p, 'photos')}>×</button>}
            </div>
          ))}
          {photos.map((f, i) => <img key={i} className="thumb" src={URL.createObjectURL(f)} alt="" />)}
          <button className="thumb add" onClick={() => photoIn.current?.click()}>＋📷</button>
        </div>
        <input ref={photoIn} type="file" accept="image/*" capture={quick ? 'environment' : undefined} multiple hidden onChange={(e) => { setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />

        {(quick || !a) && (
          <>
            <label>解説プレート（キャプション）の写真</label>
            <div className="photo-row">
              {form.plate_photos?.map((p) => <Photo key={p} path={p} className="thumb" />)}
              {plates.map((f, i) => <img key={i} className="thumb" src={URL.createObjectURL(f)} alt="" />)}
              <button className="thumb add" onClick={() => plateIn.current?.click()}>＋🏷</button>
            </div>
            <input ref={plateIn} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { setPlates((p) => [...p, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
          </>
        )}

        <label>感想</label>
        <textarea className="big-text" rows={7} value={form.comment ?? ''} onChange={(e) => set({ comment: e.target.value })} placeholder="キーボードのマイクで話しても入力できます" />

        <label>感動度</label>
        <Stars value={form.rating ?? null} onChange={(v) => set({ rating: v })} size={34} />

        <label>気分</label>
        <div className="mood-chips">
          {MOODS.map((m) => {
            const on = form.moods?.includes(m);
            return (
              <button key={m} type="button" className={`chip big ${on ? 'on' : ''}`} onClick={() => set({ moods: on ? form.moods!.filter((x) => x !== m) : [...(form.moods ?? []), m] })}>
                {m}
              </button>
            );
          })}
        </div>

        <label>鑑賞日</label>
        <input type="date" value={form.visited_on ?? ''} onChange={(e) => set({ visited_on: e.target.value })} />
        <label>美術館</label>
        <input value={form.museum_name ?? ''} onChange={(e) => set({ museum_name: e.target.value, museum_ref: null })} placeholder="チェックイン中は自動入力" />

        <button className="btn primary wide" disabled={busy} onClick={submit}>{busy ? '保存中…' : '保存'}</button>
        {msg && <p className="small">{msg}</p>}
        {existing && (
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm('この記録と写真を削除します。よろしいですか？')) return;
              await n.remove(existing.id);
              location.hash = '#/';
            }}
          >
            この記録を削除
          </button>
        )}
      </div>
    </div>
  );
}
