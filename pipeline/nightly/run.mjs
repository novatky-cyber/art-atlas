#!/usr/bin/env node
// 夜間処理のまとめ役：①記録の解説（最優先）→ ②作品の自動追加 → ③データ取得（fetch.mjs）→ ④結果の記録
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { processNotes } from './process-notes.mjs';
import { autoAdd } from './auto-add.mjs';
import { usage, MODEL } from './claude.mjs';
import { supabase, read } from './common.mjs';

const log = (...a) => console.log('[nightly]', ...a);
const summary = { started_at: new Date().toISOString(), model: MODEL };
let status = 'success';

try {
  summary.notes = await processNotes(log);
} catch (e) {
  summary.notes = { fatal: e.message };
  status = 'partial';
}
log('記録の解説', JSON.stringify(summary.notes));

try {
  summary.auto = await autoAdd(log);
} catch (e) {
  summary.auto = { fatal: e.message };
  status = 'partial';
}
log('作品の自動追加', JSON.stringify({ ...summary.auto, errors: summary.auto.errors?.length }));

try {
  execFileSync('node', ['pipeline/fetch.mjs'], { stdio: 'inherit' });
  execFileSync('node', ['scripts/validate-data.mjs'], { stdio: 'inherit' });
  const rep = read('data/fetch-report.json');
  summary.fetch = { artworks: rep.artworks, newly_fetched: rep.newly_fetched, unresolved: rep.unresolved.map((u) => u.id) };
} catch (e) {
  summary.fetch = { fatal: e.message };
  status = 'failure';
}

const n = summary.notes ?? {};
const a = summary.auto ?? {};
if ((n.errors?.length || a.errors?.length || n.skipped || a.skipped_reason) && status === 'success') status = 'partial';
summary.usage = usage;
const text = [
  `記録の解説 ${(n.linked ?? 0) + (n.created ?? 0)}件（新規ページ ${n.created ?? 0}・要確認 ${n.review ?? 0}）`,
  `作品追加 ${a.added ?? 0}点`,
  summary.fetch?.artworks ? `収録 ${summary.fetch.artworks}点` : '',
  n.skipped || a.skipped_reason ? `※${n.skipped || a.skipped_reason}` : '',
  n.fatal || a.fatal || summary.fetch?.fatal ? `エラー: ${n.fatal || a.fatal || summary.fetch.fatal}` : '',
].filter(Boolean).join('・');
summary.status = status;
summary.text = text;
writeFileSync('nightly-summary.json', JSON.stringify(summary, null, 2));
log(status, text);

if (supabase) {
  const { error } = await supabase.from('job_runs').insert({ kind: 'nightly', status, summary: text, details: summary });
  if (error) log('job_runs への記録に失敗', error.message);
}
process.exit(status === 'failure' ? 1 : 0);
