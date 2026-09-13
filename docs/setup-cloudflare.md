# Cloudflare 側のセットアップ手順

このリポジトリは Cloudflare Workers (Hono) + D1 + R2 + 静的アセット(React/Vite) 構成です。
認証はCloudflare Access等の外部IdPに依存せず、Worker自身がメール+パスワードでの会員登録・
ログインを提供します。以下は実際に Cloudflare アカウント上へリソースを作成し、デプロイするまでの
手順です。

```
[0] Cloudflareアカウント作成                      ← ブラウザだけ
--------------------------------------------------
[1] リポジトリを clone して npm install           ← ここから初めてローカル作業
[2] D1 / R2 の作成                                ← ローカル(wrangler CLI)
[3] Resend の設定(メール送信)                     ← docs/setup-selfauth.md 参照
[4] wrangler.jsonc に値を埋める
[5] デプロイ
```

## 前提

- Cloudflare アカウント(Workers Paid プラン推奨。D1/R2 は無料枠でも動作しますが、
  利用規模に応じてプランを検討してください)
- Node.js 18 以上

---

## 0. Cloudflareアカウント作成

https://dash.cloudflare.com/ を開き、メールアドレスとパスワードでアカウントを新規作成する(無料)。

## 1. リポジトリの取得と依存関係のインストール

```bash
git clone <このリポジトリのURL>
cd ai-skills-hub
npm install
npx wrangler login   # ブラウザが開くのでCloudflareアカウントで認可する
```

## 2. D1 データベースの作成

```bash
npx wrangler d1 create ai-skills-hub-db
```

出力される `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に貼り付けてください。

マイグレーションを適用します(`migrations/` 配下のファイルがテーブル定義・デフォルトタグの投入・
会員登録用のテーブル/列追加を行います):

```bash
# ローカル動作確認用
npm run db:migrate:local

# 本番D1に適用
npm run db:migrate:remote
```

## 3. R2 バケットの作成

```bash
npx wrangler r2 bucket create ai-skills-hub-assets
```

`wrangler.jsonc` の `r2_buckets[0].bucket_name` と一致していることを確認してください
(既定値のままなら変更不要です)。

## 4. Resend の設定(メール送信)・会員登録の受付範囲の設定

会員登録の確認メール・パスワードリセットメールの送信、および登録受付範囲(誰でも登録可 /
特定ドメインのみ)の設定は [`docs/setup-selfauth.md`](setup-selfauth.md) を参照してください。

## 5. wrangler.jsonc の最終確認

以下のプレースホルダーを実際の値に置き換えます:

```jsonc
"database_id": "REPLACE_WITH_D1_DATABASE_ID",  // 手順2で取得
```

`RESEND_FROM_EMAIL` / `REGISTRATION_MODE` / `ALLOWED_EMAIL_DOMAINS` は
[`docs/setup-selfauth.md`](setup-selfauth.md) の内容に沿って設定してください。

## 6. デプロイ

```bash
npm run deploy
```

これはフロントエンドのビルド (`vite build` → `frontend/dist`) を行った上で
`wrangler deploy` を実行し、Worker・静的アセット・D1/R2 バインディングを一括でデプロイします。

## 7. カスタムドメインの割り当て(任意)

「Workers & Pages」→ 対象 Worker →「Settings」→「Domains & Routes」から、独自ドメインを
割り当てられます。割り当てた場合は `wrangler.jsonc` の `APP_BASE_URL` をそのドメインに
合わせて設定してください([`docs/setup-selfauth.md`](setup-selfauth.md) 参照)。

## 8. 動作確認

1. 対象ドメイン(またはWorkerの `*.workers.dev` ドメイン)にアクセスし、会員登録画面が
   表示されることを確認する。
2. メールアドレス・パスワードで登録し、確認メールが届くこと、リンクから確認完了できることを
   確認する。
3. ログインし、一覧画面が表示されることを確認する。
4. スキルを1件投稿し、ダウンロードできること、DL数が増えることを確認する。
5. プロンプトを1件投稿し、コピー・claude.ai遷移・お気に入り登録ができることを確認する。
6. ログアウトし、再度ログインできることを確認する。
7. パスワード再設定(ログイン画面の「パスワードをお忘れですか?」)を試し、
   メール経由で再設定できることを確認する。

## ローカル開発

```bash
# 別ターミナルで Worker をローカル起動 (D1/R2 はローカルエミュレーション)
npx wrangler dev

# フロントエンドの dev server (上記 Worker に /api をプロキシ)
npm run dev:frontend
```

リポジトリ直下(`wrangler.jsonc` と同じ階層)に `.dev.vars` (Git管理対象外) を作成してください。
`.dev.vars.example` をコピーして使うと簡単です:

```bash
cp .dev.vars.example .dev.vars
```

`RESEND_API_KEY` を設定しない場合、確認メール・パスワードリセットメールは実送信されず、
リンクがターミナルにログ出力されるだけになります(ローカルでの一連の動作確認はこれで可能です)。
詳細は [`docs/setup-selfauth.md`](setup-selfauth.md) を参照してください。
