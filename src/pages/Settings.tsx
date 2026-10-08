import { useEffect, useState } from 'react';
import { useDb } from '../lib/data';
import { useAuth } from '../lib/auth';
import { useNotes } from '../lib/notes';
import { supabase, type JobRun } from '../lib/supabase';

export function Settings() {
  const db = useDb();
  const { session, owner, signOut } = useAuth();
  const { notes } = useNotes();
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (owner) supabase.from('job_runs').select('id,kind,status,summary,created_at').order('created_at', { ascending: false }).limit(10).then(({ data }) => setJobs((data as JobRun[]) ?? []));
  }, [owner]);

  const exportJson = async () => {
    setMsg('書き出しています…');
    const [c, p] = await Promise.all([supabase.from('checkins').select('*'), supabase.from('pin_positions').select('*')]);
    const blob = new Blob([JSON.stringify({ app: 'art-atlas', exported_at: new Date().toISOString(), notes, checkins: c.data ?? [], pin_positions: p.data ?? [] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `art-atlas-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('書き出しました（写真そのものは含まれません。写真は Supabase に保存されています）');
  };

  return (
    <div className="page">
      <button className="back" onClick={() => history.back()}>‹ 戻る</button>
      <h1>設定</h1>
      {session ? (
        <section className="panel">
          <h2>アカウント</h2>
          <p className="small">{session.user.email} でログイン中{owner ? '（持ち主）' : ''}</p>
          <button className="btn" onClick={signOut}>ログアウト</button>
        </section>
      ) : (
        <p className="small"><a href="#/">手帳</a>からログインしてください。</p>
      )}
      {owner && (
        <>
          <section className="panel">
            <h2>バックアップ</h2>
            <p className="small">記録・チェックイン・注釈位置を JSON で書き出します。</p>
            <button className="btn primary" onClick={exportJson}>JSONをエクスポート</button>
            {msg && <p className="small">{msg}</p>}
          </section>
          <section className="panel">
            <h2>夜間の自動処理</h2>
            {jobs.length ? (
              <ul className="job-list">
                {jobs.map((j) => (
                  <li key={j.id} className={j.status === 'failure' ? 'error' : ''}>
                    {new Date(j.created_at).toLocaleString('ja-JP')}：{j.status === 'success' ? '成功' : j.status === 'partial' ? '一部失敗' : '失敗'} {j.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">まだ実行記録はありません。</p>
            )}
            <p className="tiny muted">詳細は GitHub の Actions タブ「Nightly」で確認できます。失敗時は Issue も作成されます。</p>
          </section>
        </>
      )}
      <section className="panel">
        <h2>収録データ</h2>
        <p className="small">作品 {db.artworks.length} 点 ・ 様式 {db.styles.length} ・ 作家 {db.artists.length} ・ 用語 {db.glossary.length}</p>
        <p className="small muted">
          作品名・作家・年代・所蔵などの事実は、各美術館のオープンアクセスAPIと Wikidata / Wikimedia Commons から取得したデータです（解説プレートから作成した作品は、その読み取り結果）。
          見どころ・物語・技法・豆知識・様式解説はAI生成で、誤りを含む可能性があります。
        </p>
      </section>
    </div>
  );
}
