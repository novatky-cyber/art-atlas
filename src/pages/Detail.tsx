import { useEffect, useMemo, useState } from 'react';
import { displayTitle, fmtYear, placeLabel, useDb } from '../lib/data';
import { GENRE_LABEL, hl } from '../lib/types';
import { href } from '../lib/router';
import { useAuth } from '../lib/auth';
import { useNotes } from '../lib/notes';
import { ArtStrip } from '../components/ArtCard';
import { ImageViewer } from '../components/ImageViewer';
import { AiBadge } from '../components/AiBadge';
import { Annotated } from '../components/Annotated';
import { LinkedText } from '../components/LinkedText';
import { Photo } from '../components/Photo';
import { Stars } from '../components/Stars';

export function Detail({ id }: { id: string }) {
  const db = useDb();
  const { owner } = useAuth();
  const notes = useNotes();
  const a = db.art[id];
  const [zoom, setZoom] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const highlights = useMemo(() => (a ? a.ai.highlights.map(hl) : []), [a]);
  const [positions, setPositions] = useState(() => highlights.map((h) => ({ x: h.x, y: h.y })));
  const myNotes = notes.notes.filter((n) => n.artwork_id === id);
  // 公開画像がない作品（解説プレートから作成）は、自分の写真に注釈を重ねる
  const ownPhoto = !a?.image ? myNotes.find((n) => n.photos.length)?.photos[0] : undefined;

  const ownUrl = ownPhoto ? notes.photoUrl(ownPhoto) : undefined;
  useEffect(() => {
    if (ownPhoto && !ownUrl) notes.loadPhotoUrls([ownPhoto]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownPhoto, ownUrl]);

  useEffect(() => {
    if (owner && a) notes.pins(a.id).then((p) => p && setPositions(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, a?.id]);

  const related = useMemo(() => {
    if (!a) return { sameStyle: [], sameTime: [], win: 0 };
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

  if (!a) return <div className="page empty">作品が見つかりません。<a href={href('explore')}>探索へ</a></div>;
  const st = db.style[a.style];
  const rg = db.region[a.region];
  const pr = a.period ? db.period[a.period] : null;
  const era = a.era ? db.period[a.era] : null;
  const artist = db.artistOf[a.id] ? db.artist[db.artistOf[a.id]!] : null;
  const museum = db.museumOf[a.id] ? db.museum[db.museumOf[a.id]!] : null;
  const place = db.placeOf[a.id];
  const f = a.facts;
  const quotes = (a.ai.quotes ?? []).filter((q) => q.source); // 出典が確認できる引用のみ

  const imgSrc = a.image?.large ?? ownUrl;
  const savePins = async () => {
    try {
      await notes.savePins(a.id, positions);
      setEditing(false);
    } catch (e) {
      alert('保存できませんでした：' + (e as Error).message);
    }
  };

  return (
    <div className="page detail">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <h1 className="title">{displayTitle(a)}</h1>
      <div className="subtitle">
        {f.title}
        {a.title_ja_source === 'ai' && a.title_ja && <span className="muted small">（和題はAI訳）</span>}
      </div>
      <div className="tags">
        <a className="tag" href={href('region', a.region)}>{rg?.name_ja}</a>
        {pr && <a className="tag" href={href('period', pr.id)}>{pr.name_ja}</a>}
        {st && <a className="tag" href={href('style', st.id)}>{st.name_ja}</a>}
        <span className="tag">{GENRE_LABEL[a.genre]}</span>
        {notes.seen.has(a.id) && <span className="tag gold">見た</span>}
      </div>

      {imgSrc ? (
        <>
          <Annotated
            src={imgSrc}
            alt={displayTitle(a)}
            highlights={highlights}
            positions={positions}
            editing={editing}
            onMove={(i, p) => setPositions((ps) => ps.map((x, j) => (j === i ? p : x)))}
            onOpen={() => setZoom(true)}
            active={active}
            onSelect={setActive}
          />
          {!a.image && <p className="muted tiny center">自分の写真（手帳内のみ表示）</p>}
        </>
      ) : (
        <div className="img-fallback hero-fallback">公開画像はありません（解説プレートから作成した作品です。ログインすると自分の写真が表示されます）</div>
      )}
      {zoom && imgSrc && <ImageViewer src={imgSrc} alt={displayTitle(a)} onClose={() => setZoom(false)} />}
      {owner && imgSrc && (
        <div className="row small">
          {editing ? (
            <>
              <span className="muted">番号をドラッグして位置を調整</span>
              <button className="btn primary" onClick={savePins}>位置を保存</button>
              <button className="btn" onClick={() => setEditing(false)}>やめる</button>
            </>
          ) : (
            <button className="link" onClick={() => setEditing(true)}>注釈の位置を調整</button>
          )}
        </div>
      )}

      <section className="panel">
        <h2>見どころ <AiBadge /></h2>
        <ol className="highlights">
          {highlights.map((h, i) => (
            <li key={i} className={active === i ? 'active' : ''} onClick={() => setActive(active === i ? null : i)}>
              <LinkedText text={h.text} />
            </li>
          ))}
        </ol>
      </section>

      {/* 美術手帳 */}
      <section className="panel notebook-box">
        <a className="btn primary wide" href={`#/note/new?artwork=${encodeURIComponent(a.id)}`}>見た！ 手帳に記録する</a>
        {myNotes.map((n) => (
          <a key={n.id} className="mini-note" href={href('note', n.id)}>
            <span>{n.visited_on}</span> <span>{n.museum_name ?? ''}</span> <Stars value={n.rating} size={14} />
            {n.comment && <div className="small muted clamp2">{n.comment}</div>}
          </a>
        ))}
      </section>

      {a.ai.story && (
        <section>
          <h2>作品の物語と時代背景 <AiBadge /></h2>
          <p><LinkedText text={a.ai.story} /></p>
          {era?.background && (
            <p className="small muted">
              <a href={href('period', era.id)}>{era.name_ja}</a>：{era.background}
            </p>
          )}
        </section>
      )}

      {quotes.length > 0 && (
        <section className="panel">
          <h2>ことば</h2>
          {quotes.map((q, i) => (
            <blockquote key={i}>
              {q.text}
              <cite>— {q.url ? <a href={q.url} target="_blank" rel="noreferrer">{q.source}</a> : q.source}</cite>
            </blockquote>
          ))}
        </section>
      )}

      <section className="info-grid">
        {(museum || place || f.repository) && (
          <div className="panel">
            <h3>どこで見られるか</h3>
            {museum ? <a href={href('museum', museum.id)}>{museum.name_ja}</a> : <span>{f.repository}</span>}
            {place && (
              <div className="small">
                都市・場所：<a href={href('place', place)}>{placeLabel(db, place)}</a>
              </div>
            )}
            <div className="tiny muted">所蔵情報は取得時点のもの。展示中とは限りません。</div>
          </div>
        )}
        <div className="panel">
          <h3>作者</h3>
          {artist ? (
            <>
              <a href={href('artist', artist.id)}>{artist.name_ja}</a> <span className="small muted">{artist.life}</span>
              <div className="small"><LinkedText text={artist.bio} /> <AiBadge /></div>
            </>
          ) : (
            <span>{f.artist ?? '作者不詳'}</span>
          )}
          {f.artist && <div className="tiny muted">出典の表記：{f.artist}{f.artist_bio ? `（${f.artist_bio}）` : ''}</div>}
        </div>
        <div className="panel">
          <h3>制作方法（技法）</h3>
          {a.ai.technique && <p className="small"><LinkedText text={a.ai.technique} /> <AiBadge /></p>}
          {f.medium && <div className="tiny muted">出典の表記：{f.medium}</div>}
        </div>
        {st && (
          <div className="panel">
            <h3>この様式の見分け方：<a href={href('style', st.id)}>{st.name_ja}</a></h3>
            <ul className="features">
              {st.features.map((x) => (
                <li key={x}><LinkedText text={x} /></li>
              ))}
            </ul>
            <AiBadge />
          </div>
        )}
        <div className="panel">
          <h3>豆知識 <AiBadge /></h3>
          <p className="small"><LinkedText text={a.ai.trivia} /></p>
        </div>
      </section>

      <section className="panel">
        <h3>基本情報 <span className="muted small">（出典データ）</span></h3>
        <dl className="facts">
          <dt>年代</dt>
          <dd>{f.date ?? '不明'}{a.year_estimated && <span className="muted small">（年は推定）</span>}</dd>
          {f.culture && (<><dt>文化・地域</dt><dd>{f.culture}</dd></>)}
          {f.dimensions && (<><dt>寸法</dt><dd>{f.dimensions}</dd></>)}
          {f.credit_line && (<><dt>クレジット</dt><dd className="small">{f.credit_line}</dd></>)}
          {era && (<><dt>時代</dt><dd><a href={href('period', era.id)}>{era.name_ja}</a></dd></>)}
        </dl>
        {a.themes.length > 0 && (
          <div className="tags">
            {a.themes.map((t) => db.theme[t] && <a key={t} className="tag" href={href('theme', t)}>特集：{db.theme[t].title}</a>)}
          </div>
        )}
      </section>

      <section>
        <h2>同じ様式の作品</h2>
        <ArtStrip list={related.sameStyle} />
      </section>
      <section>
        <h2>同時代の他地域の作品 <span className="muted small">（{fmtYear(a.year)} ±{related.win}年）</span></h2>
        <ArtStrip list={related.sameTime} />
      </section>

      {myNotes.some((n) => n.photos.length) && (
        <section>
          <h2>自分の写真</h2>
          <div className="photo-row">
            {myNotes.flatMap((n) => n.photos).map((p) => <Photo key={p} path={p} className="thumb" />)}
          </div>
        </section>
      )}

      <section className="panel small credit">
        <h3>画像・出典</h3>
        {a.image ? (
          <>
            <div>画像：{a.image.credit}（{a.image.license}）</div>
            {a.image.source_url && <div><a href={a.image.source_url} target="_blank" rel="noreferrer">画像の出典ページ ↗</a></div>}
          </>
        ) : (
          <div>公開画像なし</div>
        )}
        {f.object_url && <div><a href={f.object_url} target="_blank" rel="noreferrer">作品データの出典 ↗</a></div>}
        <div className="muted">データ：{a.source.name}（{a.fetched_at} 取得）</div>
        <div className="muted">「見どころ」「物語」「技法」「豆知識」「様式の見分け方」はAI生成です。事実は出典をご確認ください。</div>
      </section>
    </div>
  );
}
