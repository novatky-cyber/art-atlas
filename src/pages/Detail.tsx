import { useMemo, useState } from 'react';
import { displayTitle, fmtYear, useDb } from '../lib/data';
import { GENRE_LABEL } from '../lib/types';
import { href } from '../lib/router';
import { useProgress, INTERVALS } from '../lib/storage';
import { ArtImage } from '../components/ArtImage';
import { ArtStrip } from '../components/ArtCard';
import { ImageViewer } from '../components/ImageViewer';
import { AiBadge } from '../components/AiBadge';

export function Detail({ id }: { id: string }) {
  const db = useDb();
  const [p] = useProgress();
  const [zoom, setZoom] = useState(false);
  const a = db.art[id];

  const related = useMemo(() => {
    if (!a) return { sameStyle: [], sameTime: [] };
    const sameStyle = db.artworks.filter((x) => x.style === a.style && x.id !== a.id).slice(0, 12);
    const win = a.year != null && a.year < 0 ? 300 : a.year != null && a.year < 1000 ? 100 : 50;
    const sameTime =
      a.year == null
        ? []
        : db.artworks
            .filter((x) => x.id !== a.id && x.year != null && x.region_group !== a.region_group && Math.abs(x.year - a.year!) <= win)
            .sort((x, y) => Math.abs(x.year! - a.year!) - Math.abs(y.year! - a.year!))
            .slice(0, 12);
    return { sameStyle, sameTime, win };
  }, [db, a]);

  if (!a) return <div className="page empty">作品が見つかりません。<a href={href()}>探索へ戻る</a></div>;
  const st = db.style[a.style];
  const rg = db.region[a.region];
  const pr = a.period ? db.period[a.period] : null;
  const card = p.cards[a.id];
  const f = a.facts;

  return (
    <div className="page detail">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <div className="hero" onClick={() => setZoom(true)}>
        <ArtImage a={a} large />
        <span className="hero-hint">タップで拡大</span>
      </div>
      {zoom && <ImageViewer src={a.image.large} alt={displayTitle(a)} onClose={() => setZoom(false)} />}

      <h1 className="title">{displayTitle(a)}</h1>
      <div className="subtitle">
        {f.title}
        {a.title_ja_source === 'ai' && a.title_ja && <span className="muted small">（和題はAI訳）</span>}
      </div>

      <div className="tags">
        <a className="tag" href={href('style', a.style)}>{st?.name_ja ?? a.style}</a>
        <span className="tag">{rg?.name_ja}</span>
        {pr && <span className="tag">{pr.name_ja}</span>}
        <span className="tag">{GENRE_LABEL[a.genre]}</span>
        {p.collected[a.id] && <span className="tag gold">獲得済み</span>}
      </div>

      <section className="panel">
        <h2>基本情報 <span className="muted small">（出典データ）</span></h2>
        <dl className="facts">
          {f.artist && (<><dt>作者</dt><dd>{f.artist}{f.artist_bio && <span className="muted small"> {f.artist_bio}</span>}</dd></>)}
          <dt>年代</dt>
          <dd>{f.date ?? '不明'}{a.year_estimated && <span className="muted small">（年は時代区分からの推定）</span>}</dd>
          {f.culture && (<><dt>文化・地域</dt><dd>{f.culture}</dd></>)}
          {f.medium && (<><dt>素材・技法</dt><dd>{f.medium}</dd></>)}
          {f.dimensions && (<><dt>寸法</dt><dd>{f.dimensions}</dd></>)}
          {f.repository && (<><dt>{a.genre === 'architecture' && a.source.key === 'wikidata' ? '所在地' : '所蔵'}</dt><dd>{f.repository}</dd></>)}
          {f.credit_line && (<><dt>クレジット</dt><dd className="small">{f.credit_line}</dd></>)}
        </dl>
      </section>

      <section className="panel">
        <h2>見どころ <AiBadge /></h2>
        <ol className="highlights">
          {a.ai.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
        <h3>豆知識 <AiBadge /></h3>
        <p>{a.ai.trivia}</p>
      </section>

      {st && (
        <section className="panel">
          <h2>
            様式：<a href={href('style', st.id)}>{st.name_ja}</a> <AiBadge />
          </h2>
          <p className="small">{st.summary}</p>
          <ul className="features">
            {st.features.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {card && (
        <section className="panel small">
          学習状況：正解 {card.correct} / 誤答 {card.wrong} ・ 次回復習 {card.due}（間隔 {INTERVALS[card.box]} 日）
        </section>
      )}

      <section>
        <h2>同じ様式の作品</h2>
        <ArtStrip list={related.sameStyle} />
      </section>
      <section>
        <h2>同時代の他地域の作品 <span className="muted small">（{fmtYear(a.year)} ±{related.win ?? 0}年）</span></h2>
        <ArtStrip list={related.sameTime} />
        {a.year != null && (
          <a className="btn wide" href={href('compare', String(a.year))}>同時代比較で見る</a>
        )}
      </section>

      <section className="panel small credit">
        <h3>画像・出典</h3>
        <div>画像：{a.image.credit}（{a.image.license}）</div>
        {a.image.source_url && (
          <div><a href={a.image.source_url} target="_blank" rel="noreferrer">画像の出典ページ ↗</a></div>
        )}
        {f.object_url && (
          <div><a href={f.object_url} target="_blank" rel="noreferrer">作品データの出典 ↗</a></div>
        )}
        <div className="muted">データ：{a.source.name}（ID {a.source.id}、{a.fetched_at} 取得）</div>
        <div className="muted">「見どころ」「豆知識」「様式解説」はAI生成です。事実は出典をご確認ください。</div>
      </section>
    </div>
  );
}
