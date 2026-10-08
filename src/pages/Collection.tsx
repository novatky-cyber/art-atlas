import { useMemo, useState } from 'react';
import { useDb } from '../lib/data';
import { useProgress } from '../lib/storage';
import { ArtCard } from '../components/ArtCard';

export function Collection() {
  const db = useDb();
  const [p] = useProgress();
  const [show, setShow] = useState<'got' | 'all'>('got');

  const got = db.artworks.filter((a) => p.collected[a.id]);
  const byGroup = useMemo(
    () =>
      Object.entries(db.targets.groups).map(([k, g]) => {
        const avail = db.artworks.filter((a) => a.region_group === k);
        return { k, label: g.label, target: g.target, avail: avail.length, got: avail.filter((a) => p.collected[a.id]).length };
      }),
    [db, p.collected],
  );
  const byEra = useMemo(
    () =>
      db.eras.map((e) => {
        const avail = db.artworks.filter((a) => a.era === e.id);
        return { k: e.id, label: e.name_ja, avail: avail.length, got: avail.filter((a) => p.collected[a.id]).length };
      }),
    [db, p.collected],
  );
  const mastered = Object.values(p.cards).filter((c) => c.box === 3).length;

  return (
    <div className="page">
      <h1>図鑑</h1>
      <div className="stat-row">
        <Stat n={got.length} l="獲得カード" />
        <Stat n={db.artworks.length} l="収録作品" />
        <Stat n={mastered} l="定着（21日間隔）" />
      </div>

      <section className="panel">
        <h2>地域別の達成率</h2>
        {byGroup.map((r) => (
          <Bar key={r.k} label={r.label} got={r.got} avail={r.avail} sub={`収録 ${r.avail} / 目標 ${r.target}`} />
        ))}
      </section>
      <section className="panel">
        <h2>時代別の達成率</h2>
        {byEra.filter((r) => r.avail).map((r) => (
          <Bar key={r.k} label={r.label} got={r.got} avail={r.avail} />
        ))}
      </section>

      <div className="chips">
        <button className={`chip ${show === 'got' ? 'on' : ''}`} onClick={() => setShow('got')}>獲得カード</button>
        <button className={`chip ${show === 'all' ? 'on' : ''}`} onClick={() => setShow('all')}>すべて（未獲得は暗く表示）</button>
      </div>
      {show === 'got' && !got.length && <p className="muted">「今日の10問」で正解するとカードを獲得できます。</p>}
      <div className="grid">
        {(show === 'got' ? got : db.artworks).map((a) => (
          <ArtCard key={a.id} a={a} locked={!p.collected[a.id]} />
        ))}
      </div>
    </div>
  );
}

const Stat = ({ n, l }: { n: number; l: string }) => (
  <div className="stat">
    <div className="stat-n">{n}</div>
    <div className="stat-l">{l}</div>
  </div>
);

function Bar({ label, got, avail, sub }: { label: string; got: number; avail: number; sub?: string }) {
  const pct = avail ? Math.round((got / avail) * 100) : 0;
  return (
    <div className="bar">
      <div className="bar-head">
        <span>{label}</span>
        <span className="muted small">
          {got}/{avail}（{pct}%）
        </span>
      </div>
      <div className="bar-track"><div style={{ width: `${pct}%` }} /></div>
      {sub && <div className="muted tiny">{sub}</div>}
    </div>
  );
}
