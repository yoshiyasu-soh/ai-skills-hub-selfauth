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
[4] GitHubトークンの設定(任意)
[5] wrangler.jsonc に値を埋める
[6] デプロイ
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
cd ai-skills-hub-selfauth
npm install
npx wrangler login   # ブラウザが開くのでCloudflareアカウントで認可する
```

## 2. D1 データベースの作成

```bash
npx wrangler d1 create ai-skills-hub-selfauth-db
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
npx wrangler r2 bucket create ai-skills-hub-selfauth-assets
```

`wrangler.jsonc` の `r2_buckets[0].bucket_name` と一致していることを確認してください
(既定値のままなら変更不要です)。

## 4. Resend の設定(メール送信)・会員登録の受付範囲の設定

会員登録の確認メール・パスワードリセットメールの送信、および登録受付範囲(誰でも登録可 /
特定ドメインのみ)の設定は [`docs/setup-selfauth.md`](setup-selfauth.md) を参照してください。

## 5. GitHubトークンの設定(任意: OSS紹介投稿の自動取得機能)

「OSS紹介」種別の投稿で、GitHubのURLを入力して「自動取得」を押すとタイトル・概要・作者・
ライセンスを自動入力できます。この機能はGitHub APIを呼び出しますが、未認証の場合は
60回/時/IPというレート制限にすぐ達してしまいます。以下の手順でトークンを設定すると、
このレート制限が大幅に緩和されます(5,000回/時)。

1. https://github.com/settings/tokens を開き、Personal Access Token を発行する
   (fine-grained PATの場合、Repository access は「Public Repositories (read-only)」、
   Permissions は Contents: Read-only のみで十分です。private リポジトリへのアクセスは不要です)。
2. 発行したトークンをCloudflareのシークレットとして設定する(値はプロンプトで入力):

   ```bash
   npx wrangler secret put GITHUB_TOKEN
   ```

3. 既にデプロイ済みの場合、シークレットの反映のため再デプロイは不要です(即座に反映されます)。

未設定のままでも「自動取得」機能自体は動作しますが、利用頻度が高い場合や短時間に
複数回叩かれる場合はレート制限に達しやすくなります。

ローカル開発でこの機能を試す場合は、`.dev.vars` に `GITHUB_TOKEN=<トークン>` を追記してください
(`.dev.vars.example` にひな形があります)。

## 6. wrangler.jsonc の最終確認

`wrangler.jsonc` は本番の資源IDを含むため Git 管理対象外です(`.gitignore` 参照)。
まだ手元に無い場合は、テンプレートをコピーして作成してください:

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

以下のプレースホルダーを実際の値に置き換えます:

```jsonc
"database_id": "REPLACE_WITH_D1_DATABASE_ID",  // 手順2で取得
```

`RESEND_FROM_EMAIL` / `REGISTRATION_MODE` / `ALLOWED_EMAIL_DOMAINS` は
[`docs/setup-selfauth.md`](setup-selfauth.md) の内容に沿って設定してください。

## 7. デプロイ

```bash
npm run deploy
```

これはフロントエンドのビルド (`vite build` → `frontend/dist`) を行った上で
`wrangler deploy` を実行し、Worker・静的アセット・D1/R2 バインディングを一括でデプロイします。

## 8. カスタムドメインの割り当て(任意)

「Workers & Pages」→ 対象 Worker →「Settings」→「Domains & Routes」から、独自ドメインを
割り当てられます。割り当てた場合は `wrangler.jsonc` の `APP_BASE_URL` をそのドメインに
合わせて設定してください([`docs/setup-selfauth.md`](setup-selfauth.md) 参照)。

## 9. 動作確認

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
