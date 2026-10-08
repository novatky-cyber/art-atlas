import { useEffect, useMemo } from 'react';
import { displayTitle, useDb } from '../lib/data';
import { buildDaily, optionLabel, TYPE_LABEL } from '../lib/quiz';
import { INTERVALS, review, today, useProgress } from '../lib/storage';
import { href } from '../lib/router';
import { ArtImage } from '../components/ArtImage';
import { AiBadge } from '../components/AiBadge';

export function Quiz() {
  const db = useDb();
  const [p, update] = useProgress();
  const date = today();

  useEffect(() => {
    if (db.artworks.length && p.daily?.date !== date) {
      update((s) => ({ ...s, daily: { date, round: 0, questions: buildDaily(db, s, date, 0), answers: [] } }));
    }
  }, [db, date, p.daily?.date, update]);

  const stats = useMemo(() => {
    const boxes = [0, 0, 0, 0];
    let due = 0;
    for (const c of Object.values(p.cards)) {
      boxes[c.box]++;
      if (c.due <= date) due++;
    }
    return { boxes, due, learned: Object.keys(p.cards).length };
  }, [p.cards, date]);

  if (!db.artworks.length) return <div className="page empty">作品データがまだありません。</div>;
  const daily = p.daily?.date === date ? p.daily : null;
  if (!daily) return <div className="page empty">問題を準備中…</div>;
  if (!daily.questions.length) return <div className="page empty">出題できる作品がありません。</div>;

  const idx = daily.answers.length;
  const lastIdx = idx - 1;
  const finished = idx >= daily.questions.length;
  // 直前に答えた問題の結果を表示中か（next を押すまで）
  const showing = daily.answers.length > 0 && daily.reveal;

  const answer = (opt: string) => {
    const q = daily.questions[idx];
    const ok = opt === q.answer;
    update((s) => {
      const h = s.history[date] ?? { correct: 0, total: 0 };
      return {
        ...s,
        cards: { ...s.cards, [q.id]: review(s.cards[q.id], ok, date) },
        collected: ok && !s.collected[q.id] ? { ...s.collected, [q.id]: date } : s.collected,
        history: { ...s.history, [date]: { correct: h.correct + (ok ? 1 : 0), total: h.total + 1 } },
        daily: { ...daily, answers: [...daily.answers, opt], reveal: true },
      };
    });
  };
  const next = () => update((s) => ({ ...s, daily: { ...daily, reveal: false } }));
  const more = () =>
    update((s) => {
      const round = daily.round + 1;
      return { ...s, daily: { date, round, questions: buildDaily(db, s, date, round), answers: [] } };
    });

  const header = (
    <div className="quiz-head">
      <h1>今日の10問</h1>
      <div className="small muted">
        復習待ち {stats.due} 枚 ・ 学習済み {stats.learned} 枚
      </div>
      <div className="boxes">
        {stats.boxes.map((n, i) => (
          <div key={i} className="box">
            <div className="box-n">{n}</div>
            <div className="box-l">{i === 0 ? '翌日' : `${INTERVALS[i]}日後`}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (showing) {
    const q = daily.questions[lastIdx];
    const a = db.art[q.id];
    const chosen = daily.answers[lastIdx];
    const ok = chosen === q.answer;
    const card = p.cards[q.id];
    return (
      <div className="page">
        {header}
        <div className={`result ${ok ? 'ok' : 'ng'}`}>{ok ? '正解！' : '不正解'}</div>
        <a className="quiz-img" href={href('a', a.id)}>
          <ArtImage a={a} large />
        </a>
        <h2>{displayTitle(a)}</h2>
        <div className="small muted">{a.facts.artist ?? ''} {a.facts.date ?? ''}</div>
        <p>
          {TYPE_LABEL[q.type]}の正解：<strong>{optionLabel(db, q.type, q.answer)}</strong>
          {!ok && chosen && <span className="muted">（あなたの回答：{optionLabel(db, q.type, chosen)}）</span>}
        </p>
        <Explain type={q.type} id={q.answer} />
        <p className="small muted">次の復習：{card?.due}（{ok ? 'カード獲得・間隔を延長' : '翌日にもう一度'}）</p>
        <div className="row">
          <a className="btn" href={href('a', a.id)}>作品を詳しく見る</a>
          <button className="btn primary" onClick={next}>{idx >= daily.questions.length ? '結果を見る' : '次へ'}</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const correct = daily.questions.filter((q, i) => daily.answers[i] === q.answer).length;
    return (
      <div className="page">
        {header}
        <div className="score">
          {correct} / {daily.questions.length} 問正解
        </div>
        <ul className="recap">
          {daily.questions.map((q, i) => {
            const a = db.art[q.id];
            const ok = daily.answers[i] === q.answer;
            return (
              <li key={i}>
                <a href={href('a', q.id)}>
                  <span className={ok ? 'ok' : 'ng'}>{ok ? '○' : '×'}</span> {displayTitle(a)}
                  <span className="muted small">（{TYPE_LABEL[q.type]}：{optionLabel(db, q.type, q.answer)}）</span>
                </a>
              </li>
            );
          })}
        </ul>
        <button className="btn primary wide" onClick={more}>もう10問解く</button>
      </div>
    );
  }

  const q = daily.questions[idx];
  const a = db.art[q.id];
  if (!a) return <div className="page empty">作品データが更新されました。<button className="btn" onClick={more}>出題し直す</button></div>;
  return (
    <div className="page">
      {header}
      <div className="progress-bar"><div style={{ width: `${(idx / daily.questions.length) * 100}%` }} /></div>
      <div className="small muted">
        第 {idx + 1} 問 / {daily.questions.length}
        {p.cards[q.id] ? ' ・ 復習' : ' ・ 新しい作品'}
      </div>
      <div className="quiz-img">
        <ArtImage a={a} large />
      </div>
      <h2 className="q">この作品の<strong>{TYPE_LABEL[q.type]}</strong>は？</h2>
      <div className="options">
        {q.options.map((o) => (
          <button key={o} className="option" onClick={() => answer(o)}>
            {optionLabel(db, q.type, o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Explain({ type, id }: { type: 'style' | 'period' | 'region'; id: string }) {
  const db = useDb();
  if (type === 'style') {
    const s = db.style[id];
    return (
      <div className="panel small">
        <div>
          <strong>見分けるポイント</strong> <AiBadge />
        </div>
        <ul className="features">
          {s.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (type === 'period') {
    const p = db.period[id];
    const y = (n: number) => (n < 0 ? `前${-n}` : `${n}`);
    return <div className="panel small">{p.name_ja}：{y(p.start)}〜{y(p.end)}年頃</div>;
  }
  const r = db.region[id];
  return <div className="panel small">{r.name_ja}{r.note && `：${r.note}`}</div>;
}
