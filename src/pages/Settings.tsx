import { useRef, useState } from 'react';
import { useDb } from '../lib/data';
import { emptyProgress, exportProgress, sanitize, useProgress } from '../lib/storage';

export function Settings() {
  const db = useDb();
  const [p, update] = useProgress();
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const onImport = async (f: File) => {
    try {
      const data = sanitize(JSON.parse(await f.text()));
      if (!confirm(`バックアップを読み込みます（獲得カード ${Object.keys(data.collected).length} 枚）。現在の進捗は上書きされます。よろしいですか？`)) return;
      update(() => data);
      setMsg('読み込みました。');
    } catch (e) {
      setMsg('読み込めませんでした：' + (e as Error).message);
    }
  };

  return (
    <div className="page">
      <h1>設定・バックアップ</h1>
      <section className="panel">
        <h2>学習データのバックアップ</h2>
        <p className="small">
          進捗はこの端末のブラウザ内（localStorage）にだけ保存されます。ホーム画面アプリを削除したり、Safari のデータを消去すると失われるため、
          ときどきエクスポートして iCloud Drive などに保存してください。
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => exportProgress(p)}>JSONをエクスポート</button>
          <button className="btn" onClick={() => file.current?.click()}>JSONをインポート</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        {msg && <p className="small">{msg}</p>}
        <p className="small muted">
          獲得カード {Object.keys(p.collected).length} 枚 ・ 学習済み {Object.keys(p.cards).length} 枚 ・ 回答日数 {Object.keys(p.history).length} 日
        </p>
      </section>
      <section className="panel">
        <h2>収録データ</h2>
        <p className="small">
          作品 {db.artworks.length} 点 ・ 様式 {db.styles.length} ・ 地域 {db.regions.length} ・ 時代区分 {db.periods.length}
        </p>
        <p className="small muted">
          作品名・作家・年代・所蔵などの事実は、各美術館のオープンアクセスAPIと Wikidata / Wikimedia Commons から取得したデータです。
          「見どころ」「豆知識」「様式の解説」はAIが生成した文章で、誤りを含む可能性があります。画像は各出典のURLを参照しています（パブリックドメインまたはフリーライセンス）。
        </p>
      </section>
      <section className="panel">
        <h2>リセット</h2>
        <button
          className="btn danger"
          onClick={() => confirm('すべての学習進捗を消去します。元に戻せません。よろしいですか？') && update(() => emptyProgress())}
        >
          進捗をすべて消去
        </button>
      </section>
    </div>
  );
}
