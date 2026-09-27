# Claude Codeプラグインマーケットプレイスとしての配信

AI Skills Hub は `/api/plugins/marketplace.json` に、Claude Codeの
`claude plugin marketplace add`/`/plugin marketplace add` が読み込める形式の
マーケットプレイス定義を動的に公開しています。type=skill のアイテムを投稿時点のDBから
都度列挙して生成するため、**マーケットプレイスへの登録という別作業は不要**です。
いつも通りスキルを投稿するだけで自動的に反映されます。

エンドユーザー向けの設定手順は、サイト内の
[Claude Codeプラグイン連携ガイド](../frontend/src/pages/ClaudePluginGuidePage.tsx)(`/guide/claude-plugin`)
に掲載しています。このドキュメントは実装の内部仕様(運用・保守担当者向け)です。

## エンドポイント

| エンドポイント | 内容 |
|---|---|
| `GET /api/plugins/marketplace.json` | type=skillのアイテムを列挙したマーケットプレイス定義 |
| `GET /api/plugins/:id/archive.zip` | 個別アイテムのプラグインzip(`.claude-plugin/plugin.json` + `skills/<id>/...`) |

いずれも他の `/api/*` と同じ `authMiddleware` の対象であり、認証は
`Authorization: Bearer <個人アクセストークン>`(`/settings/tokens` で発行)のみに対応します
(セッションCookieはブラウザ以外のクライアントから送れないため、実質的にトークン必須)。

## 変換ルール

- `type=skill` のみが対象。`prompt`/`external` は一覧に含まれない。
- SKILL.md単体投稿 → そのまま `skills/<id>/SKILL.md` として配信。
- ZIP投稿 → ZIP内から `SKILL.md`(大文字小文字を区別しない)を探し、そのファイルが
  ある階層を基点にして `skills/<id>/` 配下に再パッケージする。**SKILL.mdが見つからない場合、
  エラーにはせず単に一覧から除外する**(投稿者への通知は行っていない)。
- プラグイン名(`plugin.json` の `name` および marketplace.json の `plugins[].name`)には
  `item.id`(UUID)を使う。`slug`([worker/src/lib/slug.ts](../worker/src/lib/slug.ts))は
  日本語を許容しておりClaude Codeのプラグイン名制約(非ASCII不可)と両立しないため。
  利用者に見える名前は `displayName`/`description` に投稿タイトル・概要をそのまま使う。

## キャッシュ

変換結果(zipとそのSHA256)は `items` テーブルの `plugin_archive_r2_key` /
`plugin_archive_sha256` / `plugin_archive_source_r2_key` にキャッシュする
(`worker/src/lib/pluginArchive.ts`)。`plugin_archive_source_r2_key` が現在の `r2_key` と
一致する間はキャッシュを再利用し、スキル本体のファイルが更新されるたびに自動で再構築される。
これにより `marketplace.json` が返すSHA256と、実際にダウンロードされるzipの内容は常に一致する
(Claude Code側のarchive sourceはSHA256検証に対応している)。

アイテム削除時は `worker/src/routes/items.ts` のDELETEハンドラで、本体ファイルと同様に
`plugin_archive_r2_key` が指すR2オブジェクトも削除する。

## セキュリティ上の注意

ZIP投稿は登録者が自由に内容を決められるため、再パッケージ時にzip内のパス(`../`等)を
無検証で展開先に使うとパストラバーサル(Zip Slip)が成立しうる。`pluginArchive.ts` の
`isSafeRelativePath` で、`..`・空セグメント・絶対パス・バックスラッシュ・NUL文字を含む
相対パスを再パッケージ対象から除外している。新しくこのロジックを触る場合は
`worker/test/plugins.test.ts` の該当テストを壊していないか確認すること。

## ローカルでの動作確認(参考)

```bash
npx wrangler dev

curl -H "Authorization: Bearer <ローカルで発行したトークン>" \
  http://localhost:8787/api/plugins/marketplace.json
```

## 今後の拡張(スコープ外)

- `type=prompt` を `commands/`(スラッシュコマンド)としてプラグイン化する
- Web UIの投稿完了画面等に「このスキルはClaude Codeプラグインとしても配信されます」といった
  案内を出す(現状は `/guide/claude-plugin` を能動的に見つけてもらう形)
- ZIP投稿でSKILL.mdが見つからず一覧から除外された場合の、投稿者への通知
