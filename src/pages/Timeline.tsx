import { useMemo, useState } from 'react';
import { displayTitle, fmtRange, useDb } from '../lib/data';
import { href } from '../lib/router';
import { useNotes } from '../lib/notes';

/** 美術年表：縦に時代（世界共通区分）、横に地域。私が見た作品に印。 */
export function Timeline() {
  const db = useDb();
  const { seen } = useNotes();
  const [onlySeen, setOnlySeen] = useState(false);
  const groups = Object.entries(db.targets.groups);
  const cells = useMemo(() => {
    const m: Record<string, typeof db.artworks> = {};
    for (const a of db.artworks) {
      if (onlySeen && !seen.has(a.id)) continue;
      const k = `${a.era}|${a.region_group}`;
      (m[k] ??= []).push(a);
    }
    for (const k in m) m[k].sort((x, y) => (x.year ?? 0) - (y.year ?? 0));
    return m;
  }, [db, seen, onlySeen]);

  return (
    <div className="page wide-page">
      <h1>美術年表</h1>
      <div className="row small">
        <span className="seen-dot" /> 私が見た作品
        <button className={`chip ${onlySeen ? 'on' : ''}`} onClick={() => setOnlySeen(!onlySeen)}>見た作品だけ</button>
      </div>
      <div className="timeline-scroll">
        <table className="timeline">
          <thead>
            <tr>
              <th className="sticky">時代</th>
              {groups.map(([k, g]) => <th key={k}>{g.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {db.eras.map((e) => (
              <tr key={e.id}>
                <th className="sticky">
                  <a href={href('period', e.id)}>{e.name_ja}</a>
                  <div className="tiny muted">{fmtRange(e.start, e.end)}</div>
                </th>
                {groups.map(([k]) => (
                  <td key={k}>
                    {(cells[`${e.id}|${k}`] ?? []).map((a) => (
                      <a key={a.id} className={`tl-item ${seen.has(a.id) ? 'seen' : ''}`} href={href('a', a.id)}>
                        {seen.has(a.id) && <span className="seen-dot" />}
                        {displayTitle(a)}
                      </a>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
