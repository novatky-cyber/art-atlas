import { useEffect, useState } from 'react';
import { useNotes } from '../lib/notes';
import { useAuth } from '../lib/auth';
import { useDb } from '../lib/data';

interface Place {
  id: string;
  name: string;
  dist: number;
  lat: number;
  lng: number;
}

const dist = (a: number, b: number, c: number, d: number) => {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(toR(c - a) / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(toR(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** 現在地から近くの美術館・博物館を OpenStreetMap（Overpass API）で探す */
async function nearby(lat: number, lng: number): Promise<Place[]> {
  const q = `[out:json][timeout:20];(nwr["tourism"~"museum|gallery"](around:2500,${lat},${lng}););out center tags 40;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`検索に失敗しました (${res.status})`);
  const json = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  return json.elements
    .map((e) => {
      const la = e.lat ?? e.center?.lat ?? lat;
      const lo = e.lon ?? e.center?.lon ?? lng;
      const name = e.tags?.['name:ja'] || e.tags?.name || '';
      return { id: `osm:${e.type}/${e.id}`, name, lat: la, lng: lo, dist: dist(lat, lng, la, lo) };
    })
    .filter((p) => p.name)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 15);
}

export function Checkin() {
  const { owner } = useAuth();
  const db = useDb();
  const n = useNotes();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState('現在地を取得しています…');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setMsg('この端末では位置情報が使えません。名前を入力してください。');
      setPlaces([]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCoords(c);
        setMsg('近くの美術館を探しています…');
        try {
          const list = await nearby(c.lat, c.lng);
          setPlaces(list);
          setMsg(list.length ? '' : '近くに候補が見つかりませんでした。名前を入力してください。');
        } catch (e) {
          setPlaces([]);
          setMsg((e as Error).message + '。名前を入力してください。');
        }
      },
      () => {
        setPlaces([]);
        setMsg('位置情報を取得できませんでした（設定で許可が必要です）。名前を入力してください。');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  if (!owner) return <div className="page empty">ログインが必要です。<a href="#/">手帳へ</a></div>;

  const pick = async (museum: string, ref: string | null) => {
    try {
      const known = db.museums.find((m) => m.name_ja === museum || m.name_en === museum);
      await n.checkIn(museum, known?.id ?? ref, coords?.lat, coords?.lng);
      location.hash = '#/';
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="page">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <h1>チェックイン</h1>
      <p className="small muted">チェックイン中に登録した記録には、鑑賞日と美術館が自動で入ります（あとで編集できます）。</p>
      {msg && <p className="small">{msg}</p>}
      <div className="place-list">
        {places?.map((p) => (
          <button key={p.id} className="option" onClick={() => pick(p.name, p.id)}>
            {p.name} <span className="muted small">{p.dist < 1000 ? `${Math.round(p.dist)}m` : `${(p.dist / 1000).toFixed(1)}km`}</span>
          </button>
        ))}
      </div>
      <div className="form">
        <label>候補にない場合は名前を入力</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：国立西洋美術館" />
        <button className="btn primary wide" disabled={!name.trim()} onClick={() => pick(name.trim(), null)}>この名前でチェックイン</button>
      </div>
      <p className="tiny muted">周辺検索は OpenStreetMap のデータ（© OpenStreetMap contributors）を利用しています。</p>
    </div>
  );
}
