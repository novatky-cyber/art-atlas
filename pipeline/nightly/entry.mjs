// 作品1点の「分類＋解説」を Claude で生成する（夜間の自動追加・プレート由来の新規作品で共通）
import { catalog, jsonCall } from './claude.mjs';

const cat = catalog();

const SYSTEM = `あなたは美術初心者向けの日本語の美術図鑑の編集者です。
与えられた作品の「取得データ（事実）」と画像をもとに、分類と解説を作ります。

厳守すること：
- 作品名・作家・年代・所蔵などの事実は、与えられた取得データにあるものだけを前提にする。データにない固有名詞・数値・逸話を新たに断定しない。
- 一般によく知られた美術史の知識は使ってよいが、確信がない内容は「〜とされる」「〜と考えられている」とヘッジする。
- 見どころ（highlights）は3〜4点。画像を見て確認できる視覚的特徴を書き、各点の画像上のおおよその位置を x, y（左上0・右下100のパーセント）で示す。画像が見られない場合は構図の一般的な位置で推定してよい。
- story は「作品の物語（何が描かれ・作られているか）」と「時代背景（なぜその時代・地域でこれが生まれたか）」を合わせて120〜220字。
- technique は制作方法（素材・技法）を初心者向けに60〜120字。取得データの素材表記があれば踏まえる。
- trivia は豆知識を1つ（40〜100字）。確かな一般知識に限る。
- region・style・themes は下の一覧の id から選ぶ。合う様式がなければ最も近いものを選ぶ。themes は該当がなければ空配列。
- 文体は「だ・である」調、簡潔に。
- 作品として図鑑に載せるのに不適切（断片的すぎる、写真資料、内容が判別できない等）なら suitable を false にする。

${cat.text}`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suitable', 'genre', 'region', 'style', 'title_ja', 'highlights', 'story', 'technique', 'trivia', 'themes'],
  properties: {
    suitable: { type: 'boolean' },
    genre: { type: 'string', enum: ['painting', 'sculpture', 'architecture', 'craft'] },
    region: { type: 'string', enum: cat.regions.map((r) => r.id) },
    style: { type: 'string', enum: cat.styles.map((s) => s.id) },
    title_ja: { type: 'string' },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'x', 'y'],
        properties: { text: { type: 'string' }, x: { type: 'integer' }, y: { type: 'integer' } },
      },
    },
    story: { type: 'string' },
    technique: { type: 'string' },
    trivia: { type: 'string' },
    themes: { type: 'array', items: { type: 'string', enum: cat.themes.map((t) => t.id) } },
  },
};

/**
 * @param facts 取得データ（title, artist, date, culture, medium, repository など）
 * @param image Claude に渡す画像ブロック（任意）
 */
export async function generateEntry(facts, image) {
  const content = [
    ...(image ? [image] : []),
    { type: 'text', text: `取得データ（事実）:\n${JSON.stringify(facts, null, 1)}\n\nこの作品の分類と解説を作ってください。` },
  ];
  let r;
  try {
    r = await jsonCall({ system: SYSTEM, content, schema: SCHEMA });
  } catch (e) {
    // 画像 URL を取得できない等で失敗したら画像なしで再試行
    if (!image) throw e;
    r = await jsonCall({ system: SYSTEM, content: content.slice(1), schema: SCHEMA });
  }
  const clamp = (n) => Math.max(2, Math.min(98, Math.round(n)));
  r.highlights = r.highlights.slice(0, 4).map((h) => ({ text: h.text, x: clamp(h.x), y: clamp(h.y) }));
  if (r.highlights.length < 3) throw new Error('見どころが3点未満');
  // 地域とスタイルの整合を緩くチェック（矛盾していても採用はする）
  return r;
}
