# CLAUDE.md — art-atlas（世界の美術・建築 図鑑クイズ）

iPhone のホーム画面で使う個人用 PWA。静的サイト（Vite + React + TypeScript）を GitHub Actions でビルドし GitHub Pages に公開する。
サーバー・ログイン・DB なし。学習進捗は localStorage（JSON でエクスポート/インポート）。

## 構成
- `src/` アプリ本体（ハッシュルーター、`lib/storage.ts` に Leitner 方式の間隔反復、`lib/quiz.ts` に出題生成）
- `data/` アプリが読むデータ（ビルド時に `public/data/` へコピーされる）
  - `artworks.json` … **パイプラインが生成。手で編集しない**
  - `styles.json` / `periods.json` … `scripts/gen-styles.mjs` / `scripts/gen-periods.mjs` で生成（編集はスクリプト側で）
  - `regions.json` … 直接編集
  - `fetch-report.json` … 直近の取得結果（未解決・重複の一覧）
- `config/targets.json` … 地域グループ別の目標点数（合計2000）
- `pipeline/seeds/batch-NNN.json` … 作品シード（取得条件＋分類＋AI解説）。**作品追加はここに書く**
- `pipeline/fetch.mjs` … シードを Met / AIC / Cleveland / Smithsonian / Wikidata(+Commons) で解決し `data/artworks.json` を生成
- `.github/workflows/fetch-data.yml` … 取得を手動実行（workflow_dispatch）→ data/ をコミット → 再デプロイ
- `.github/workflows/deploy.yml` … main への push で Pages へデプロイ

## 重要な制約
- **このクラウド環境からは美術館 API に届かない**（プロキシで 403）。取得は必ず GitHub Actions の「Fetch artwork data」で行う。
- 事実（作品名・作家・年代・所蔵・画像URL・ライセンス）は取得データのみ。シードに事実を書き込まない（`match` は照合条件であって表示されない）。
- 見どころ・豆知識・様式解説は AI 生成で、`ai_generated: true` を必ず保持する。
- 画像はリポジトリに保存しない（出典 URL を参照）。
- **Met の検索 API（/search）は HTTP 410 で廃止済み**。Met は Wikidata の P3634（Met object ID）経由で探してから /objects/{id} を取得する。
  そのため Met のシードは Wikidata 上の作品名（英語ラベル）で見つかる `queries` を書く（例：「Mezzetin」「The Harvesters」）。
  確実な Met ID が分かる場合は `source_id` を併記すると最も確実。Wikidata にない無名の工芸品は AIC / Cleveland を `source` にする。

## 「作品を100点追加して」と言われたときの手順

1. `npm ci && npm run status` で地域別の不足を確認し、「次の100点」の配分に従う（`node scripts/status.mjs 100`）。
2. 既存シードの id・作品と重複しないものを選ぶ（`grep -h '"id"' pipeline/seeds/*.json` で確認）。
   - パブリックドメインで、Met / AIC / Cleveland のオープンアクセスにあることが確実な作品を優先。
   - 建築・遺跡は `source: "wikidata"`（Commons に自由ライセンス画像があるもの）。
   - ジャンル（painting / sculpture / architecture / craft）も偏らないようにする。
   - 作家没後70年未満の作品は避ける（美術館側が PD 扱いでも、原則避ける）。
3. `pipeline/seeds/batch-NNN.json`（連番）を新規作成。スキーマは下記。100点＋予備5〜10点を書く（一部は未解決になるため）。
4. `npm run validate && npm run build` が通ることを確認。
5. ブランチにコミット → push → PR 作成 → CI 緑を確認 → main にマージ（ユーザーは公開まで自動で行うことを了承済み）。
6. GitHub MCP の `actions_run_trigger`（method: run_workflow, workflow_id: fetch-data.yml, ref: main, inputs: {mode: "missing", batch: "batch-NNN"}）で取得を実行。
   MCP が使えない場合は、ユーザーに Actions タブから実行してもらう。
7. 実行完了後 `git pull origin main` で `data/fetch-report.json` を確認。
   - `unresolved` のシードは、`query`/`match` を直すか別作品に差し替えて再コミット → `only` 入力で再取得。
   - `duplicates` は片方のシードを差し替える。
8. 結果（取得点数・未解決・地域別進捗）をユーザーに報告。

## シードのスキーマ
```jsonc
{
  "id": "hokusai-great-wave",          // 英小文字・数字・ハイフン。全バッチで一意
  "source": "met",                      // met | aic | cleveland | smithsonian | wikidata
  "source_id": "45434",                 // 任意。確実なときだけ（違っても match で弾かれ検索にフォールバック）
  "query": "Under the Wave off Kanagawa",   // 検索語（queries: [...] で複数可）
  "match": {                            // 取得候補の照合条件（すべて満たす候補だけ採用）
    "title": ["under the wave off kanagawa"],  // 題名に全て含む（大小文字・ダイアクリティカル無視）
    "title_any": ["jar", "vase"],              // 題名にどれか1つを含む
    "artist": "hokusai",                       // 作家名に含む
    "any": ["edo"],                            // 全メタデータ（文化・時代・分類・素材等）に全て含む
    "year": [1820, 1840]                       // 制作年の範囲が重なる
  },
  "fallbacks": [{ "source": "aic", "query": "..." }],  // 任意。美術館シードは他館も自動で探す（auto_fallback:false で無効）
  "genre": "painting",                  // painting | sculpture | architecture | craft（版画は painting）
  "region": "japan",                    // data/regions.json の id（制作地）
  "style": "ukiyo-e",                   // data/styles.json の id
  "period": "japan:edo",                // 任意。通常は取得年から自動判定。建築で創建年と現存建物の年代がずれる場合などに指定
  "ai": {
    "title_ja": "冨嶽三十六景 神奈川沖浪裏",   // 和題（Wikidata に日本語ラベルがあればそちらが優先）
    "highlights": ["…", "…", "…"],            // 見どころ3点。画面上で確認できる視覚的特徴を中心に
    "trivia": "…"                              // 豆知識1つ。よく知られた事実のみ。不確かなら「〜とされる」「諸説ある」
  }
}
```

### 解説文の書き方
- 見どころは「どこを見ると面白いか」を、画像を見ながら確かめられる形で書く（40〜70字程度）。
- 匿名作品・同種作品が多いもの（埴輪、青花磁器など）は、取得結果が別個体でも成り立つよう類型レベルで書き、`match` を広めにする。
- 特定作品に固有の記述をする場合は `match` を厳しく（題名＋作家＋年代）。
- 数字・固有名詞は確信のあるものだけ。断定できないものはヘッジする。

## 様式・時代・地域を増やすとき
- 様式：`scripts/gen-styles.mjs` に追記 → `node scripts/gen-styles.mjs`（features は「見分けるポイント」でクイズ解説に使う）
- 時代：`scripts/gen-periods.mjs` に追記 → `node scripts/gen-periods.mjs`。地域は `period_scheme` で時代区分スキームを参照
- 地域グループの目標数：`config/targets.json`

## コマンド
- `npm run dev` / `npm run build` / `npm run validate` / `npm run status`
- `npm run fetch-data -- --only=id1,id2`（ローカル実行は API に届く環境のみ）
