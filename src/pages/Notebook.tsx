import { useEffect, useMemo, useState } from 'react';
import { displayTitle, useDb } from '../lib/data';
import { href } from '../lib/router';
import { useAuth } from '../lib/auth';
import { useNotes } from '../lib/notes';
import type { Note } from '../lib/supabase';
import { Login } from './Login';
import { Photo } from '../components/Photo';
import { Stars } from '../components/Stars';
import { ArtImage } from '../components/ArtImage';

const STATUS_LABEL = { pending: '解説待ち', review: '要確認', done: '完成' } as const;
type View = 'recent' | 'museum' | 'year';

export function Notebook() {
  const db = useDb();
  const { ready, session, owner } = useAuth();
  const n = useNotes();
  const [view, setView] = useState<View>('recent');

  useEffect(() => {
    const paths = n.notes.map((x) => x.photos[0]).filter(Boolean);
    if (paths.length) n.loadPhotoUrls(paths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.notes]);

  const groups = useMemo(() => {
    const by = (key: (x: Note) => string) => {
      const m = new Map<string, Note[]>();
      for (const x of n.notes) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
      return [...m.entries()];
    };
    if (view === 'museum') return by((x) => x.museum_name || '美術館未設定').sort((a, b) => b[1].length - a[1].length);
    if (view === 'year') return by((x) => x.visited_on.slice(0, 4) + '年').sort((a, b) => b[0].localeCompare(a[0]));
    return [['', n.notes] as [string, Note[]]];
  }, [n.notes, view]);

  if (!ready) return <div className="page empty">読み込み中…</div>;
  if (!session) return <Login />;
  if (owner === false)
    return <div className="page empty">この手帳は別のアカウントの持ち主専用です。<button className="btn" onClick={() => location.reload()}>再読み込み</button></div>;

  const pending = n.notes.filter((x) => x.status !== 'done').length;
  const museums = new Set(n.notes.map((x) => x.museum_name).filter(Boolean)).size;

  return (
    <div className="page">
      <div className="row-between">
        <h1>美術手帳</h1>
        <a className="link small" href={href('settings')}>設定</a>
      </div>

      {n.active ? (
        <div className="checkin-bar">
          <div>
            <div className="small muted">チェックイン中</div>
            <strong>{n.active.museum_name}</strong>
          </div>
          <button className="btn small-btn" onClick={() => n.checkOut()}>終了</button>
        </div>
      ) : (
        <a className="btn wide" href={href('checkin')}>📍 チェックイン（近くの美術館を選ぶ）</a>
      )}

      <div className="stat-row">
        <div className="stat"><div className="stat-n">{n.notes.length}</div><div className="stat-l">記録</div></div>
        <div className="stat"><div className="stat-n">{n.seen.size}</div><div className="stat-l">見た作品（DB）</div></div>
        <div className="stat"><div className="stat-n">{museums}</div><div className="stat-l">美術館</div></div>
      </div>
      {n.lastJob && (
        <p className={`small ${n.lastJob.status === 'failure' ? 'error' : 'muted'}`}>
          夜間処理（{new Date(n.lastJob.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）：
          {n.lastJob.status === 'success' ? '成功' : n.lastJob.status === 'partial' ? '一部失敗' : '失敗'} {n.lastJob.summary}
        </p>
      )}
      {pending > 0 && <p className="small">解説待ち・要確認：{pending} 件（夜間に自動で解説されます）</p>}

      <div className="chips">
        {(['recent', 'museum', 'year'] as View[]).map((v) => (
          <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
            {v === 'recent' ? '新しい順' : v === 'museum' ? '美術館別' : '年別'}
          </button>
        ))}
      </div>

      {n.error && <p className="error small">{n.error}</p>}
      {n.loading && !n.notes.length && <p className="muted">読み込み中…</p>}
      {!n.loading && !n.notes.length && (
        <div className="empty small">
          まだ記録がありません。<br />作品ページの「見た！」、または右下の「＋」から記録できます。
        </div>
      )}

      {groups.map(([label, list]) => (
        <section key={label}>
          {label && <h2>{label} <span className="muted small">{list.length}件</span></h2>}
          <div className="note-list">
            {list.map((x) => {
              const a = x.artwork_id ? db.art[x.artwork_id] : null;
              return (
                <a key={x.id} className="note-card" href={href('note', x.id)}>
                  <div className="note-thumb">
                    {x.photos[0] ? <Photo path={x.photos[0]} /> : a ? <ArtImage a={a} /> : <div className="img-fallback">写真なし</div>}
                  </div>
                  <div className="note-body">
                    <div className="note-title">{a ? displayTitle(a) : x.title_memo || '（作品名未入力）'}</div>
                    <div className="small muted">{x.visited_on} ・ {x.museum_name ?? '美術館未設定'}</div>
                    <Stars value={x.rating} size={13} />
                    {x.status !== 'done' && <span className={`status ${x.status}`}>{STATUS_LABEL[x.status]}</span>}
                    {x.moods.length > 0 && <div className="tiny muted">{x.moods.join('・')}</div>}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <a className="fab" href="#/note/new?quick=1" aria-label="未登録作品をクイック登録">＋</a>
    </div>
  );
}
