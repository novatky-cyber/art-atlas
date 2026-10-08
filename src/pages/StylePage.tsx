import { useDb } from '../lib/data';
import { href } from '../lib/router';
import { ArtCard } from '../components/ArtCard';
import { AiBadge } from '../components/AiBadge';

const y = (n: number) => (n < 0 ? `前${-n}` : `${n}`);

export function StylePage({ id }: { id: string }) {
  const db = useDb();
  const s = db.style[id];
  if (!s) return <div className="page empty">様式が見つかりません。<a href={href()}>探索へ</a></div>;
  const list = db.artworks.filter((a) => a.style === id).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  return (
    <div className="page">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <h1>{s.name_ja}</h1>
      <div className="subtitle">{s.name_en} ・ {y(s.start)}〜{y(s.end)}年頃</div>
      <div className="tags">
        {s.regions.map((r) => (
          <span key={r} className="tag">{db.region[r]?.name_ja}</span>
        ))}
      </div>
      <section className="panel">
        <h2>概要 <AiBadge /></h2>
        <p>{s.summary}</p>
        <h3>見分けるポイント</h3>
        <ul className="features">
          {s.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <h2>収録作品（{list.length}）</h2>
      <div className="grid">
        {list.map((a) => (
          <ArtCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
