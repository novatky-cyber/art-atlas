// Claude API 呼び出しの共通処理（構造化出力・画像入力・リトライ・拒否時のフォールバック）
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';

export const MODEL = process.env.ART_ATLAS_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.ART_ATLAS_EFFORT || 'medium';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
export const hasClaude = () => Boolean(client);

export const usage = { input: 0, output: 0, cache_read: 0, calls: 0 };

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

/** 様式・地域・テーマの一覧（システムプロンプトに入れてキャッシュする） */
export function catalog() {
  const regions = read('data/regions.json');
  const styles = read('data/styles.json');
  const themes = read('data/themes.json');
  const y = (n) => (n < 0 ? `前${-n}` : `${n}`);
  return {
    regions,
    styles,
    themes,
    text: [
      '## 地域（region）',
      ...regions.map((r) => `- ${r.id}: ${r.name_ja}（${r.note}）`),
      '## 様式（style）',
      ...styles.map((s) => `- ${s.id}: ${s.name_ja}（${s.regions.join(',')}／${y(s.start)}〜${y(s.end)}）`),
      '## テーマ（themes）',
      ...themes.map((t) => `- ${t.id}: ${t.title}`),
    ].join('\n'),
  };
}

/**
 * JSON スキーマで構造化した応答を得る。
 * content: Anthropic のコンテンツブロック配列（画像＋テキスト）
 */
export async function jsonCall({ system, content, schema, maxTokens = 8000 }) {
  if (!client) throw new Error('ANTHROPIC_API_KEY が設定されていません');
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  };
  let res;
  try {
    // 安全分類による拒否時は推奨モデルへ自動フォールバック
    res = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) res = await client.messages.create(params);
    else throw e;
  }
  usage.calls++;
  usage.input += res.usage?.input_tokens ?? 0;
  usage.output += res.usage?.output_tokens ?? 0;
  usage.cache_read += res.usage?.cache_read_input_tokens ?? 0;
  if (res.stop_reason === 'refusal') throw new Error(`応答が拒否されました（${res.stop_details?.category ?? 'unknown'}）`);
  if (res.stop_reason === 'max_tokens') throw new Error('出力が上限で途切れました');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

export const imageUrl = (url) => ({ type: 'image', source: { type: 'url', url } });
export const imageB64 = (data, media_type = 'image/jpeg') => ({ type: 'image', source: { type: 'base64', media_type, data } });

/** 並列数を制限して順に処理 */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k).catch((e) => ({ error: e }));
      }
    }),
  );
  return out;
}
