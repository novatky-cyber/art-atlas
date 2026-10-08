# CLAUDE.md — art-atlas（自分の美術手帳 ＋ 世界の美術・建築の教科書）

主目的は「美術館で見た作品を記録する自分の美術手帳」。作品データベースはそれを支える教科書で、
知識が蓄積され、様式・作家・美術館・時代・テーマ・用語で**繋がる**ことを最重要とする。
クイズ・学習ゲーム要素は廃止済み（再導入しない）。

## 構成
- アプリ：Vite + React + TypeScript の PWA（GitHub Pages、ハッシュルーター）。依存は React / supabase-js / PWA プラグインのみ。
- 手帳データ：Supabase（project ref `mcpibsyhekyboohsgrbr`、東京リージョン）
  - テーブル `notes`（記録）, `checkins`, `pin_positions`（注釈位置の微調整）, `job_runs`（夜間処理の記録）, `app_owner`（持ち主1人）
  - Storage バケット `photos`（非公開、パス `{user_id}/{note_id}/{uuid}.jpg`、端末で長辺1600pxに圧縮）
  - RLS：`user_id = auth.uid() and is_owner()`。最初にログインしたユーザーが `claim_owner()` で持ち主になる
  - 認証：メールの6桁コード（PWA と Safari は保存領域が別なのでリンクではなくコード入力が基本）
  - 公開キー（publishable）は `src/lib/config.ts` に記載（RLS 前提で公開可）。サービスロールキーは GitHub Secrets のみ
- 作品データ（公開・静的）：`data/`
  - `artworks.json` … パイプラインが生成。**手で編集しない**（`node pipeline/fetch.mjs --curate-only` でシードの解説を反映）
  - `styles.json` / `periods.json` … `scripts/gen-styles.mjs` / `scripts/gen-periods.mjs`（時代背景は `scripts/period-backgrounds.json`）
  - `artists.json` / `museums.json`（美術館＋都市）/ `glossary.json`（用語集）/ `themes.json`（テーマ特集）… `scripts/gen-reference.mjs`
  - `regions.json` … 直接編集
- シード：`pipeline/seeds/*.json`（`batch-NNN` 手書き、`auto-YYYY-MM-DD` 夜間自動、`notes.json` 手帳の記録から作成）
- 夜間処理：`.github/workflows/nightly.yml`（毎晩 3:00 JST）→ `pipeline/nightly/run.mjs`
  1. `process-notes.mjs`：「解説待ち」の記録のプレート写真を Claude で読み取り → 既存作品に紐づけ／オープンアクセスで見つかればその所蔵品で新規作成／なければ `source: "plate"`（公開画像なし）で新規作成。確信度が低ければ `review`（候補最大3つ）
  2. `auto-add.mjs`：`config/targets.json` の不足地域（日本以外を優先）に合わせ、AIC（is_boosted）・Cleveland（highlight）のパブリックドメイン作品から 50 点を選び、Claude（画像を見て）で分類・見どころ（位置付き）・物語・技法・豆知識を生成
  3. `fetch.mjs` → 検証 → コミット → デプロイ。結果は Supabase `job_runs` と Actions サマリーに記録、失敗時は Issue 作成
  - Secrets：`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`。Variables（任意）：`ART_ATLAS_MODEL`（既定 `claude-opus-5-5`）, `NIGHTLY_COUNT`

## 重要な制約
- **このクラウド環境からは美術館 API・Supabase API に届かない**（プロキシで 403）。取得は GitHub Actions で行う。Supabase のスキーマ変更は Supabase MCP（apply_migration）で。
- 事実（作品名・作家・年代・所蔵・画像URL・ライセンス）は取得データのみ（plate 由来は解説プレートの読み取り結果）。シードに事実を書かない。
- 見どころ・物語・技法・豆知識・様式解説・時代背景・用語・作家紹介は AI 生成で、`ai_generated: true` / 画面に「AI生成」を表示する。
- 引用（`ai.quotes`）は出典が確認できるものだけ。出典がなければ欄ごと出さない。
- 自分の写真は手帳内でのみ表示（公開サイト・公開データに含めない）。
- **Met の検索 API（/search）は HTTP 410 で廃止済み**。Met は Wikidata の P3634 経由で探す。確実なら `source_id` を併記。

## 手動で作品を追加するとき（「作品を○点追加して」）
1. `npm ci && npm run status` で地域別の不足を確認。
2. `pipeline/seeds/batch-NNN.json` を新規作成（スキーマは下記）。既存 id と重複しないこと。
3. `npm run validate && npm run build`。
4. ブランチ → PR → CI 緑 → main にマージ（ユーザーは公開まで自動で行うことを了承済み）。
5. GitHub MCP `actions_run_trigger`（workflow_id: fetch-data.yml, ref: main, inputs: {mode: "missing", batch: "batch-NNN"}）。
6. `data/fetch-report.json` の `unresolved` を直して `only` で再取得。

## シードのスキーマ
```jsonc
{
  "id": "hokusai-great-wave",
  "source": "met",                 // met | aic | cleveland | smithsonian | wikidata | plate
  "source_id": "45434",            // 任意（確実なときだけ）
  "query": "Under the Wave off Kanagawa", "queries": ["..."],
  "match": { "title": [], "title_any": [], "artist": "", "any": [], "year": [1820, 1840] },
  "genre": "painting",             // painting | sculpture | architecture | craft
  "region": "japan", "style": "ukiyo-e", "period": "japan:edo",   // period は任意
  "themes": ["nature-garden"],     // religion | light | power-architecture | human-body | nature-garden
  "plate": { "title": "...", "artist": "...", "date": "...", "technique": "...", "collection": "..." },  // source: plate のみ
  "ai": {
    "title_ja": "冨嶽三十六景 神奈川沖浪裏",
    "highlights": [{ "text": "見どころ", "x": 25, "y": 35 }],   // 3〜4点、画像上の位置（%）
    "story": "作品の物語と時代背景（120〜220字）",
    "technique": "制作方法（60〜120字）",
    "trivia": "豆知識",
    "quotes": [{ "text": "...", "source": "出典", "url": "..." }]  // 任意。出典必須
  }
}
```

## コマンド
- `npm run dev` / `npm run build` / `npm run validate` / `npm run status`
- `node pipeline/fetch.mjs --curate-only`（通信なしで解説・分類だけ反映）
- `node scripts/gen-reference.mjs`（作家・美術館・用語・テーマ再生成）
