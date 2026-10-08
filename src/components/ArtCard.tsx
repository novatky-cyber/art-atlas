import type { Artwork } from '../lib/types';
import { displayTitle, fmtYear, useDb } from '../lib/data';
import { href } from '../lib/router';
import { useNotes } from '../lib/notes';
import { ArtImage } from './ArtImage';

export function ArtCard({ a }: { a: Artwork }) {
  const db = useDb();
  const { seen } = useNotes();
  return (
    <a className="card" href={href('a', a.id)}>
      <div className="card-img">
        <ArtImage a={a} />
        {seen.has(a.id) && <span className="seen-mark" title="見た作品">見た</span>}
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

export function ArtGrid({ list }: { list: Artwork[] }) {
  if (!list.length) return <p className="muted small">該当作品はまだありません</p>;
  return (
    <div className="grid">
      {list.map((a) => (
        <ArtCard key={a.id} a={a} />
      ))}
    </div>
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
