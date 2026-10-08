import { useMemo } from 'react';
import { fmtRange, placeLabel, useDb } from '../lib/data';
import { href } from '../lib/router';
import { useNotes } from '../lib/notes';
import { ArtGrid, ArtStrip } from '../components/ArtCard';
import { AiBadge } from '../components/AiBadge';
import { LinkedText } from '../components/LinkedText';
import type { Artwork } from '../lib/types';

const byYear = (a: Artwork, b: Artwork) => (a.year ?? 0) - (b.year ?? 0);

function Back() {
  return <button className="back" onClick={() => history.back()}>‹ 戻る</button>;
}

/** 「私が見た作品」 */
function MySeen({ list }: { list: Artwork[] }) {
  const { seen } = useNotes();
  const mine = list.filter((a) => seen.has(a.id));
  if (!mine.length) return null;
  return (
    <section>
      <h2>私が見た作品（{mine.length}）</h2>
      <ArtStrip list={mine} />
    </section>
  );
}

// ---------- 索引 ----------
export function Connect() {
  const db = useDb();
  const count = (pred: (a: Artwork) => boolean) => db.artworks.filter(pred).length;
  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of db.artworks) {
      const p = db.placeOf[a.id];
      if (p) m.set(p, (m.get(p) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [db]);
  const usedStyles = db.styles.filter((s) => count((a) => a.style === s.id));
  return (
    <div className="page">
      <h1>つなぐ</h1>
      <section>
        <h2>テーマ特集</h2>
        <div className="link-list">
          {db.themes.map((t) => <a key={t.id} className="link-card" href={href('theme', t.id)}>{t.title}</a>)}
        </div>
      </section>
      <section>
        <h2>様式（何派）</h2>
        <div className="chips wrap">
          {usedStyles.map((s) => <a key={s.id} className="chip" href={href('style', s.id)}>{s.name_ja}</a>)}
        </div>
        <details><summary className="small">収録作品のない様式も表示</summary>
          <div className="chips wrap">
            {db.styles.filter((s) => !usedStyles.includes(s)).map((s) => <a key={s.id} className="chip" href={href('style', s.id)}>{s.name_ja}</a>)}
          </div>
        </details>
      </section>
      <section>
        <h2>作家</h2>
        <div className="chips wrap">
          {db.artists.map((a) => <a key={a.id} className="chip" href={href('artist', a.id)}>{a.name_ja}</a>)}
        </div>
      </section>
      <section>
        <h2>美術館・都市・場所</h2>
        <div className="chips wrap">
          {db.museums.filter((m) => count((a) => db.museumOf[a.id] === m.id)).map((m) => <a key={m.id} className="chip" href={href('museum', m.id)}>{m.name_ja}</a>)}
        </div>
        <div className="chips wrap">
          {places.map(([p, n]) => <a key={p} className="chip" href={href('place', p)}>{placeLabel(db, p)} <span className="muted">{n}</span></a>)}
        </div>
      </section>
      <section>
        <h2>時代</h2>
        <div className="chips wrap">
          {db.eras.map((e) => <a key={e.id} className="chip" href={href('period', e.id)}>{e.name_ja}</a>)}
        </div>
      </section>
      <section>
        <h2>地域</h2>
        <div className="chips wrap">
          {db.regions.map((r) => <a key={r.id} className="chip" href={href('region', r.id)}>{r.name_ja}</a>)}
        </div>
      </section>
      <section>
        <a className="btn wide" href={href('glossary')}>用語集（技法・建築用語）</a>
        <a className="btn wide" href={href('timeline')}>美術年表</a>
      </section>
    </div>
  );
}

// ---------- 様式 ----------
export function StylePage({ id }: { id: string }) {
  const db = useDb();
  const s = db.style[id];
  if (!s) return <div className="page empty">様式が見つかりません。</div>;
  const list = db.artworks.filter((a) => a.style === id).sort(byYear);
  const artistIds = new Set([...db.artists.filter((a) => a.styles.includes(id)).map((a) => a.id), ...(list.map((a) => db.artistOf[a.id]).filter(Boolean) as string[])]);
  const neighbors = db.styles.filter((x) => x.id !== id && x.regions.some((r) => s.regions.includes(r)) && x.end >= s.start - 150 && x.start <= s.end + 150);
  return (
    <div className="page">
      <Back />
      <h1>{s.name_ja}</h1>
      <div className="subtitle">{s.name_en} ・ {fmtRange(s.start, s.end)}頃</div>
      <div className="tags">{s.regions.map((r) => <a key={r} className="tag" href={href('region', r)}>{db.region[r]?.name_ja}</a>)}</div>
      <section className="panel">
        <h2>概要 <AiBadge /></h2>
        <p><LinkedText text={s.summary} /></p>
        <h3>見分け方3点</h3>
        <ol className="features">{s.features.map((f) => <li key={f}><LinkedText text={f} /></li>)}</ol>
      </section>
      <MySeen list={list} />
      <section>
        <h2>代表作（収録 {list.length}点）</h2>
        <ArtGrid list={list} />
      </section>
      {artistIds.size > 0 && (
        <section>
          <h2>主な作家</h2>
          <div className="chips wrap">{[...artistIds].map((a) => db.artist[a] && <a key={a} className="chip" href={href('artist', a)}>{db.artist[a].name_ja}</a>)}</div>
        </section>
      )}
      {neighbors.length > 0 && (
        <section>
          <h2>前後・隣接する様式</h2>
          <div className="chips wrap">{neighbors.map((x) => <a key={x.id} className="chip" href={href('style', x.id)}>{x.name_ja}</a>)}</div>
        </section>
      )}
    </div>
  );
}

// ---------- 作家 ----------
export function ArtistPage({ id }: { id: string }) {
  const db = useDb();
  const a = db.artist[id];
  if (!a) return <div className="page empty">作家が見つかりません。</div>;
  const list = db.artworks.filter((x) => db.artistOf[x.id] === id).sort(byYear);
  return (
    <div className="page">
      <Back />
      <h1>{a.name_ja}</h1>
      <div className="subtitle">{a.name_en} ・ {a.life}</div>
      <div className="tags">
        <a className="tag" href={href('region', a.region)}>{db.region[a.region]?.name_ja}</a>
        {a.styles.map((s) => <a key={s} className="tag" href={href('style', s)}>{db.style[s]?.name_ja}</a>)}
      </div>
      <section className="panel"><p><LinkedText text={a.bio} /> <AiBadge /></p></section>
      <MySeen list={list} />
      <section><h2>作品（{list.length}）</h2><ArtGrid list={list} /></section>
    </div>
  );
}

// ---------- 美術館 ----------
export function MuseumPage({ id }: { id: string }) {
  const db = useDb();
  const { notes } = useNotes();
  const m = db.museum[id];
  if (!m) return <div className="page empty">美術館が見つかりません。</div>;
  const list = db.artworks.filter((x) => db.museumOf[x.id] === id).sort(byYear);
  const visits = notes.filter((n) => n.museum_ref === id || n.museum_name === m.name_ja);
  return (
    <div className="page">
      <Back />
      <h1>{m.name_ja}</h1>
      <div className="subtitle">{m.name_en}</div>
      <div className="tags"><a className="tag" href={href('place', m.city)}>{db.city[m.city]?.name_ja}（{db.city[m.city]?.country_ja}）</a></div>
      {m.url && <p className="small"><a href={m.url} target="_blank" rel="noreferrer">公式サイト ↗</a></p>}
      {visits.length > 0 && <p className="small">この美術館の記録：{visits.length}件（最終 {visits[0].visited_on}）</p>}
      <MySeen list={list} />
      <section><h2>収録作品（{list.length}）</h2><ArtGrid list={list} /></section>
    </div>
  );
}

// ---------- 都市・場所 ----------
export function PlacePage({ id }: { id: string }) {
  const db = useDb();
  const c = db.city[id];
  const list = db.artworks.filter((x) => db.placeOf[x.id] === id).sort(byYear);
  const ms = db.museums.filter((m) => m.city === id);
  return (
    <div className="page">
      <Back />
      <h1>{c?.name_ja ?? id}</h1>
      {c && <div className="subtitle">{c.country_ja}</div>}
      {ms.length > 0 && (
        <section><h2>美術館</h2><div className="chips wrap">{ms.map((m) => <a key={m.id} className="chip" href={href('museum', m.id)}>{m.name_ja}</a>)}</div></section>
      )}
      <MySeen list={list} />
      <section><h2>ここで見られる作品・建築（{list.length}）</h2><ArtGrid list={list} /></section>
    </div>
  );
}

// ---------- 地域 ----------
export function RegionPage({ id }: { id: string }) {
  const db = useDb();
  const r = db.region[id];
  if (!r) return <div className="page empty">地域が見つかりません。</div>;
  const list = db.artworks.filter((a) => a.region === id).sort(byYear);
  const periods = db.periods.filter((p) => p.scheme === r.period_scheme);
  return (
    <div className="page">
      <Back />
      <h1>{r.name_ja}</h1>
      <div className="subtitle">{r.note}</div>
      <section><h2>時代区分</h2><div className="chips wrap">{periods.map((p) => <a key={p.id} className="chip" href={href('period', p.id)}>{p.name_ja}</a>)}</div></section>
      <section><h2>様式</h2><div className="chips wrap">{db.styles.filter((s) => s.regions.includes(id)).map((s) => <a key={s.id} className="chip" href={href('style', s.id)}>{s.name_ja}</a>)}</div></section>
      <MySeen list={list} />
      <section><h2>作品（{list.length}）</h2><ArtGrid list={list} /></section>
    </div>
  );
}

// ---------- 時代 ----------
export function PeriodPage({ id }: { id: string }) {
  const db = useDb();
  const p = db.period[id];
  if (!p) return <div className="page empty">時代が見つかりません。</div>;
  const isWorld = p.scheme === 'world';
  const list = db.artworks.filter((a) => (isWorld ? a.era === id : a.period === id)).sort(byYear);
  const sub = isWorld ? db.periods.filter((x) => x.scheme !== 'world' && x.end >= p.start && x.start <= p.end) : [];
  const sameScheme = !isWorld ? db.periods.filter((x) => x.scheme === p.scheme) : [];
  const overlapEra = !isWorld ? db.eras.filter((e) => e.end >= p.start && e.start <= p.end) : [];
  const groups = Object.entries(db.targets.groups).map(([k, g]) => ({ k, label: g.label, list: list.filter((a) => a.region_group === k) })).filter((g) => g.list.length);
  return (
    <div className="page">
      <Back />
      <h1>{p.name_ja}</h1>
      <div className="subtitle">{fmtRange(p.start, p.end)}頃{!isWorld && db.regions.find((r) => r.period_scheme === p.scheme) ? ` ・ ${db.regions.filter((r) => r.period_scheme === p.scheme).map((r) => r.name_ja).join('・')}` : ''}</div>
      {p.background && <section className="panel"><h2>時代背景 <AiBadge /></h2><p><LinkedText text={p.background} /></p></section>}
      {overlapEra.length > 0 && <div className="tags">{overlapEra.map((e) => <a key={e.id} className="tag" href={href('period', e.id)}>世界史：{e.name_ja}</a>)}</div>}
      <MySeen list={list} />
      {isWorld ? (
        groups.map((g) => <section key={g.k}><h2>{g.label}</h2><ArtStrip list={g.list} /></section>)
      ) : (
        <section><h2>作品（{list.length}）</h2><ArtGrid list={list} /></section>
      )}
      {sub.length > 0 && (
        <section><h2>この頃の各地の時代</h2><div className="chips wrap">{sub.map((x) => <a key={x.id} className="chip" href={href('period', x.id)}>{x.name_ja}</a>)}</div></section>
      )}
      {sameScheme.length > 0 && (
        <section><h2>前後の時代</h2><div className="chips wrap">{sameScheme.map((x) => <a key={x.id} className={`chip ${x.id === id ? 'on' : ''}`} href={href('period', x.id)}>{x.name_ja}</a>)}</div></section>
      )}
    </div>
  );
}

// ---------- テーマ ----------
export function ThemePage({ id }: { id: string }) {
  const db = useDb();
  const t = db.theme[id];
  if (!t) return <div className="page empty">テーマが見つかりません。</div>;
  const list = db.artworks.filter((a) => a.themes.includes(id)).sort(byYear);
  return (
    <div className="page">
      <Back />
      <h1>特集：{t.title}</h1>
      <section className="panel">
        <p><LinkedText text={t.lead} /> <AiBadge /></p>
        <ul className="features">{t.points.map((x) => <li key={x}><LinkedText text={x} /></li>)}</ul>
      </section>
      <section><h2>関連する様式</h2><div className="chips wrap">{t.styles.map((s) => db.style[s] && <a key={s} className="chip" href={href('style', s)}>{db.style[s].name_ja}</a>)}</div></section>
      <MySeen list={list} />
      <section><h2>作品（{list.length}）</h2><ArtGrid list={list} /></section>
    </div>
  );
}

// ---------- 用語集 ----------
export function Glossary({ id }: { id?: string }) {
  const db = useDb();
  const cats = [...new Set(db.glossary.map((g) => g.category))];
  const t = id ? db.term[id] : null;
  if (t) {
    const re = new RegExp(t.aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
    const list = db.artworks.filter((a) => re.test([a.ai.technique, a.ai.story, ...a.ai.highlights.map((h) => (typeof h === 'string' ? h : h.text))].join(' ')));
    return (
      <div className="page">
        <Back />
        <h1>{t.term}</h1>
        <div className="subtitle">{t.category}</div>
        <section className="panel"><p>{t.desc} <AiBadge /></p></section>
        <section><h2>この用語が出てくる作品（{list.length}）</h2><ArtGrid list={list.slice(0, 40)} /></section>
        <a className="btn wide" href={href('glossary')}>用語集の一覧へ</a>
      </div>
    );
  }
  return (
    <div className="page">
      <Back />
      <h1>用語集</h1>
      {cats.map((c) => (
        <section key={c}>
          <h2>{c}</h2>
          <dl className="glossary">
            {db.glossary.filter((g) => g.category === c).map((g) => (
              <div key={g.id}><dt><a href={href('glossary', g.id)}>{g.term}</a></dt><dd className="small">{g.desc}</dd></div>
            ))}
          </dl>
        </section>
      ))}
      <p className="tiny muted">用語の説明はAI生成です。</p>
    </div>
  );
}
