import { useMemo, useState } from 'react';
import { useDb } from '../lib/data';
import { GENRE_LABEL, type Genre } from '../lib/types';
import { ArtCard } from '../components/ArtCard';

interface Filters {
  era: string;
  group: string;
  region: string;
  genre: string;
  style: string;
  q: string;
  sort: 'year' | 'random';
}
// 詳細画面から戻っても絞り込みと表示件数を保つ
let saved: Filters = { era: '', group: '', region: '', genre: '', style: '', q: '', sort: 'year' };
let savedLimit = 40;
const PAGE = 40;

export function Explore() {
  const db = useDb();
  const [f, setF] = useState<Filters>(saved);
  const [limit, setLimit] = useState(savedLimit);
  const set = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.group !== undefined) next.region = '';
    saved = next;
    savedLimit = PAGE;
    setF(next);
    setLimit(PAGE);
  };

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const r = db.artworks.filter(
      (a) =>
        (!f.era || a.era === f.era) &&
        (!f.group || a.region_group === f.group) &&
        (!f.region || a.region === f.region) &&
        (!f.genre || a.genre === f.genre) &&
        (!f.style || a.style === f.style) &&
        (!q ||
          [a.title_ja, a.ai.title_ja, a.facts.title, a.facts.artist, db.style[a.style]?.name_ja]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
    if (f.sort === 'random') return [...r].sort(() => Math.random() - 0.5);
    return [...r].sort((x, y) => (x.year ?? 9999) - (y.year ?? 9999));
  }, [db, f]);

  const regionsInGroup = db.regions.filter((r) => !f.group || r.group === f.group);
  const stylesAvail = db.styles.filter((s) => db.artworks.some((a) => a.style === s.id));

  if (!db.artworks.length) {
    return (
      <div className="page">
        <h1>探索</h1>
        <div className="empty">
          作品データがまだありません。<br />
          GitHub の Actions タブで「Fetch artwork data」を実行すると、作品が取得されて自動で公開されます。
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>探索</h1>
      <div className="filters">
        <input type="search" placeholder="作品名・作家・様式で検索" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <div className="chips">
          <Chip on={!f.genre} onClick={() => set({ genre: '' })}>すべて</Chip>
          {(Object.keys(GENRE_LABEL) as Genre[]).map((g) => (
            <Chip key={g} on={f.genre === g} onClick={() => set({ genre: f.genre === g ? '' : g })}>
              {GENRE_LABEL[g]}
            </Chip>
          ))}
        </div>
        <div className="selects">
          <select value={f.era} onChange={(e) => set({ era: e.target.value })}>
            <option value="">時代：すべて</option>
            {db.eras.map((p) => (
              <option key={p.id} value={p.id}>{p.name_ja}</option>
            ))}
          </select>
          <select value={f.group} onChange={(e) => set({ group: e.target.value })}>
            <option value="">地域：すべて</option>
            {Object.entries(db.targets.groups).map(([k, g]) => (
              <option key={k} value={k}>{g.label}</option>
            ))}
          </select>
          <select value={f.region} onChange={(e) => set({ region: e.target.value })}>
            <option value="">細分：すべて</option>
            {regionsInGroup.map((r) => (
              <option key={r.id} value={r.id}>{r.name_ja}</option>
            ))}
          </select>
          <select value={f.style} onChange={(e) => set({ style: e.target.value })}>
            <option value="">様式：すべて</option>
            {stylesAvail.map((s) => (
              <option key={s.id} value={s.id}>{s.name_ja}</option>
            ))}
          </select>
        </div>
        <div className="row-between small muted">
          <span>{list.length} 点</span>
          <button className="link" onClick={() => set({ sort: f.sort === 'year' ? 'random' : 'year' })}>
            {f.sort === 'year' ? '年代順 ▸ シャッフル' : 'シャッフル ▸ 年代順'}
          </button>
        </div>
      </div>
      <div className="grid">
        {list.slice(0, limit).map((a) => (
          <ArtCard key={a.id} a={a} />
        ))}
      </div>
      {limit < list.length && (
        <button
          className="btn wide"
          onClick={() => {
            savedLimit = limit + PAGE;
            setLimit(savedLimit);
          }}
        >
          もっと見る（残り {list.length - limit} 点）
        </button>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
