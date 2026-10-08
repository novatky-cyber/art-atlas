# 世界の美術・建築 図鑑クイズ（Art Atlas）

iPhone のホーム画面に追加して使う、個人用の美術・建築図鑑クイズです。
作品を眺めて楽しみながら、**様式・時代・地域を見分けられる**ようになることを目指します（最終目標 2000 点）。

公開URL：https://novatky-cyber.github.io/art-atlas/

## 画面
| 画面 | 内容 |
|---|---|
| 探索 | 時代・地域・ジャンル（絵画/彫刻/建築/工芸）・様式で絞り込み、カード一覧 |
| 作品詳細 | 画像（タップで全画面・ピンチ拡大）、基本情報（出典データ）、見どころ3点・豆知識（AI生成）、同じ様式／同時代の他地域作品 |
| 今日の10問 | 様式・時代・地域を4択で出題。選択肢は様式・時代・地域データから自動生成 |
| 間隔反復 | Leitner 方式。誤答は翌日、正答は 3日→7日→21日 と間隔を延ばす（今日の10問に復習が優先して入る） |
| 図鑑 | 正解して獲得したカード、地域別・時代別の達成率 |
| 同時代比較 | 年代スライダーで、その時代の世界各地の作品を並べて表示 |
| 設定 | 学習データの JSON エクスポート/インポート、リセット |

## 仕組み
- **静的サイト**：Vite + React + TypeScript。依存は React と PWA プラグインのみ（ルーターも自前の数十行）で、保守対象を最小化しています。
- **公開**：`main` に push すると GitHub Actions がビルドし GitHub Pages に公開。
- **PWA**：オフラインでもアプリと閲覧済み画像が表示されます。
- **データ**：`data/` の4ファイル（artworks / styles / regions / periods）を ID で参照。
- **学習進捗**：端末の localStorage のみに保存。消えると戻らないので、ときどき「設定 → エクスポート」で iCloud Drive 等に保存してください。

## データの出典とルール
- 作品の事実（作品名・作家・年代・所蔵）と画像 URL・ライセンスは、以下の API から取得したデータのみを使用します。
  - The Metropolitan Museum of Art Collection API（CC0）
  - Art Institute of Chicago API（CC0 作品のみ）
  - Cleveland Museum of Art Open Access API（CC0）
  - Smithsonian Open Access API（任意。リポジトリの Secret `SI_API_KEY` を設定した場合のみ）
  - Wikidata / Wikimedia Commons（建築。画像ごとのライセンスと作者を表示）
- 画像はリポジトリに保存せず、各機関の URL を参照します。
- 「見どころ」「豆知識」「様式の解説」「和題（一部）」は AI 生成で、データ上 `ai_generated: true` を付け、画面に「AI生成」と表示します。

## 作品データの取得（手動実行）
1. GitHub のリポジトリ画面 → **Actions** タブ → 左の **Fetch artwork data** → **Run workflow**
2. 通常はそのまま実行（未取得の作品だけ取得）。完了すると `data/` が自動コミットされ、サイトも自動で更新されます。
3. 結果は実行ページの Summary と `data/fetch-report.json`（未解決の作品一覧）で確認できます。

## 作品を100点ずつ追加する（フェーズ2以降）
Claude Code に **「作品を100点追加して」** と依頼するだけで進められるよう、手順を `CLAUDE.md` にまとめています。概要：
1. `npm run status` で地域別の不足を確認し、次の100点の配分を決める
2. `pipeline/seeds/batch-NNN.json` に取得条件・分類・AI解説を書く
3. 検証・ビルド → main へマージ → 「Fetch artwork data」を `batch=batch-NNN` で実行
4. `data/fetch-report.json` の未解決分を差し替えて再取得

## ローカル開発（任意）
```sh
npm ci
npm run dev      # 開発サーバー
npm run build    # 検証 + 型チェック + ビルド
npm run status   # 地域別の進捗と次の配分
```
地域配分の目標は `config/targets.json` で変更できます。
