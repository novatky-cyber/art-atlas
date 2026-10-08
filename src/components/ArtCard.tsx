import type { Artwork } from '../lib/types';
import { displayTitle, fmtYear, useDb } from '../lib/data';
import { href } from '../lib/router';
import { ArtImage } from './ArtImage';

export function ArtCard({ a, locked = false }: { a: Artwork; locked?: boolean }) {
  const db = useDb();
  return (
    <a className={`card ${locked ? 'locked' : ''}`} href={href('a', a.id)}>
      <div className="card-img">
        <ArtImage a={a} />
      </div>
      <div className="card-body">
        <div className="card-title">{displayTitle(a)}</div>
        <div className="card-meta">
          {db.region[a.region]?.name_ja} · {fmtYear(a.year)}
        </div>
      </div>
    </a>
  );
}

export function ArtStrip({ list }: { list: Artwork[] }) {
  if (!list.length) return <p className="muted small">該当作品はまだありません</p>;
  return (
    <div className="strip">
      {list.map((a) => (
        <ArtCard key={a.id} a={a} />
      ))}
    </div>
  );
}
