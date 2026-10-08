#!/usr/bin/env node
// 夜間ルーティン用：記録の更新・実行記録の SQL を安全に組み立てて出力する（Supabase MCP の execute_sql に渡す）。
//   node pipeline/nightly/note-sql.mjs notes <decisions.json>
//     decisions.json = [{ "id": "<note uuid>", "status": "done|review|pending", "artwork_id": "...|null", "ai_result": {...} }]
//   node pipeline/nightly/note-sql.mjs job <success|partial|failure> "<要約>" [details.json]
import { readFileSync } from 'node:fs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  let tag = 'v';
  while (s.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${s}$${tag}$`;
};

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'notes') {
  const decisions = JSON.parse(readFileSync(rest[0], 'utf8'));
  for (const d of decisions) {
    if (!UUID.test(d.id)) throw new Error(`不正な id: ${d.id}`);
    if (!['done', 'review', 'pending'].includes(d.status)) throw new Error(`不正な status: ${d.status}`);
    const sets = [`status = ${lit(d.status)}`, `artwork_id = ${lit(d.artwork_id ?? null)}`, `ai_result = ${lit(d.ai_result ?? null)}::jsonb`];
    if (d.title_memo) sets.push(`title_memo = ${lit(d.title_memo)}`);
    if (d.artist_memo) sets.push(`artist_memo = ${lit(d.artist_memo)}`);
    // 夜間処理の間に本人が編集・確定した記録は上書きしない
    console.log(`update public.notes set ${sets.join(', ')} where id = '${d.id}' and status = 'pending';`);
  }
} else if (mode === 'job') {
  const [status, summary, detailsFile] = rest;
  if (!['success', 'partial', 'failure'].includes(status)) throw new Error('status は success|partial|failure');
  const details = detailsFile ? readFileSync(detailsFile, 'utf8') : null;
  console.log(`insert into public.job_runs (kind, status, summary, details) values ('nightly-routine', ${lit(status)}, ${lit(summary)}, ${details ? `${lit(details)}::jsonb` : 'null'});`);
} else {
  console.error('usage: note-sql.mjs notes <decisions.json> | job <status> "<summary>" [details.json]');
  process.exit(1);
}
