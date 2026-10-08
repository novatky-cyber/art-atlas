import { useMemo, useState } from 'react';
import { fmtYear, useDb } from '../lib/data';
import { go } from '../lib/router';
import { ArtStrip } from '../components/ArtCard';

// 年代スライダーは区間ごとに縮尺を変える（古代は粗く、近世以降は細かく）
const SEGMENTS: [number, number, number, number][] = [
  // [年の始点, 年の終点, スライダー始点, スライダー終点]
  [-3000, -500, 0, 150],
  [-500, 1000, 150, 400],
  [1000, 1950, 400, 1000],
];
const toYear = (v: number) => {
  for (const [y0, y1, s0, s1] of SEGMENTS) if (v <= s1) return Math.round(y0 + ((v - s0) / (s1 - s0)) * (y1 - y0));
  return 1950;
};
const toSlider = (y: number) => {
  for (const [y0, y1, s0, s1] of SEGMENTS) if (y <= y1) return Math.max(s0, s0 + ((y - y0) / (y1 - y0)) * (s1 - s0));
  return 1000;
};
const autoWindow = (y: number) => (y < -500 ? 300 : y < 1000 ? 100 : y < 1500 ? 50 : 25);
const PRESETS = [-2500, -450, 100, 700, 1200, 1500, 1650, 1780, 1880];

export function Compare({ initial }: { initial?: string }) {
  const db = useDb();
  const [year, setYear] = useState(() => (initial && !Number.isNaN(Number(initial)) ? Number(initial) : 1500));
  const [win, setWin] = useState<number | null>(null);
  const w = win ?? autoWindow(year);

  const groups = useMemo(() => {
    const hits = db.artworks.filter((a) => a.year != null && Math.abs(a.year - year) <= w);
    return Object.entries(db.targets.groups)
      .map(([k, g]) => ({ k, label: g.label, list: hits.filter((a) => a.region_group === k).sort((x, y) => x.year! - y.year!) }))
      .filter((g) => g.list.length);
  }, [db, year, w]);
  const total = groups.reduce((s, g) => s + g.list.length, 0);

  const setY = (y: number) => {
    setYear(y);
    history.replaceState(null, '', `#/compare/${y}`);
  };

  return (
    <div className="page">
      <h1>同時代比較</h1>
      <div className="compare-ctl">
        <div className="year-big">{fmtYear(year)}<span className="muted small"> ±{w}年</span></div>
        <input type="range" min={0} max={1000} step={1} value={toSlider(year)} onChange={(e) => setY(toYear(Number(e.target.value)))} />
        <div className="chips">
          {PRESETS.map((y) => (
            <button key={y} className={`chip ${year === y ? 'on' : ''}`} onClick={() => setY(y)}>
              {fmtYear(y)}
            </button>
          ))}
        </div>
        <div className="row small">
          <span className="muted">幅：</span>
          {[null, 25, 50, 100, 300].map((v) => (
            <button key={String(v)} className={`chip ${win === v ? 'on' : ''}`} onClick={() => setWin(v)}>
              {v == null ? '自動' : `±${v}`}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">{total} 点 ・ 地域ごとに横スクロールできます</p>
      {groups.map((g) => (
        <section key={g.k}>
          <h2>{g.label}</h2>
          <ArtStrip list={g.list} />
        </section>
      ))}
      {!total && (
        <div className="empty">
          この時期の作品はまだ収録されていません。
          <button className="btn" onClick={() => go('')}>探索へ</button>
        </div>
      )}
    </div>
  );
}
