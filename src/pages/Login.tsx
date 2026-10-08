import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * メール認証。ホーム画面アプリ（PWA）と Safari は保存領域が別なので、
 * メール内のリンクではなく 6 桁のコードを入力する方式を基本にする。
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    setBusy(true);
    setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    setBusy(false);
    if (error) setMsg('送信できませんでした：' + error.message);
    else setSent(true);
  };
  // メール本文のリンクを（タップせず）長押しでコピーして貼り付ける方式。テンプレート変更なしで PWA でもログインできる
  const [link, setLink] = useState('');
  const verifyLink = async () => {
    setBusy(true);
    setMsg('');
    try {
      const u = new URL(link.trim());
      const token = u.searchParams.get('token') ?? u.searchParams.get('token_hash');
      const type = (u.searchParams.get('type') ?? 'magiclink') as 'magiclink' | 'signup' | 'email';
      if (!token) throw new Error('リンクにトークンが含まれていません');
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type });
      if (error) throw error;
    } catch (e) {
      setMsg('ログインできませんでした：' + (e as Error).message + '（リンクは1回しか使えません。一度タップしたリンクは無効です）');
    }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg('コードが正しくないか、期限切れです：' + error.message);
  };

  return (
    <div className="page">
      <h1>美術手帳にログイン</h1>
      <p className="small muted">あなた専用の手帳です。メールアドレスに届く確認コードでログインします（パスワード不要）。</p>
      <div className="form">
        <label>メールアドレス</label>
        <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary wide" disabled={busy || !email.includes('@')} onClick={send}>
          {sent ? 'もう一度送る' : '確認コードを送る'}
        </button>
        {sent && (
          <>
            <label>メールに届いた6桁のコード</label>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="code-input" />
            <button className="btn primary wide" disabled={busy || code.trim().length < 6} onClick={verify}>ログイン</button>
          </>
        )}
        {sent && (
          <>
            <label>コードが無い場合：メールの「Log In」リンクを長押し →「リンクをコピー」して貼り付け</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…supabase.co/auth/v1/verify?token=…" />
            <button className="btn primary wide" disabled={busy || !link.includes('token')} onClick={verifyLink}>リンクでログイン</button>
            <p className="tiny muted">リンクをタップして開くと使い切りになり、このアプリではログインできなくなります。必ず長押しでコピーしてください。届かない場合は迷惑メールフォルダも確認してください（送信は1時間に数通までに制限されています）。</p>
          </>
        )}
        {msg && <p className="small error">{msg}</p>}
      </div>
    </div>
  );
}
