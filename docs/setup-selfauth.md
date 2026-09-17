# 会員登録機能(自前認証)のセットアップ

このリポジトリは Cloudflare Access(Entra ID SSO)に依存せず、Worker自身がメール+パスワードでの
会員登録・ログインを提供します。認証まわりで追加設定が必要なのは以下の2点だけです。

1. メール送信の設定(Resend または Cloudflare Email Service)
2. 会員登録の受付範囲の設定(誰でも登録可 / 特定ドメインのみ)

## 1. メール送信の設定(確認メール・パスワードリセットメールの送信)

Cloudflare Workers は SMTP を直接扱えないため、確認メール・パスワードリセットメールの送信には
外部サービス(Resend)または Cloudflare 自身の Email Service を使います。`wrangler.jsonc` の
`vars.EMAIL_PROVIDER` でどちらを使うか切り替えます(既定は `"resend"`)。

| | `EMAIL_PROVIDER=resend`(既定) | `EMAIL_PROVIDER=cloudflare` |
|---|---|---|
| 利用可能なプラン | Workers Freeプランでも利用可 | **Workers Paidプラン限定**(Freeプランだと送信時にエラーになる) |
| 必要な外部アカウント | Resendアカウント + APIキー | 不要(Cloudflareアカウント内で完結) |
| ドメイン認証 | Resend側でSPF/DKIM設定 | Cloudflareダッシュボードで「Onboard Domain」(SPF/DKIM/DMARC/バウンス用MXを自動追加) |

どちらを使うか判断に迷う場合は、まず既定の `resend` のままで問題ありません。既に
Workers Paidプランを契約済みで、外部サービスへの依存を減らしたい場合に `cloudflare` を検討してください。

### 1-A. Resend を使う場合(既定)

1. https://resend.com/ でアカウントを作成する(無料枠あり)。
2. **本番運用する場合は必ず送信元ドメインを追加・認証(SPF/DKIM)してください**
   (Dashboard → Domains → Add Domain)。ドメイン未認証のままだと、Resend既定のテストドメイン
   `onboarding@resend.dev` からしか送信できず、宛先やレート制限に制約があります
   (お試し・動作確認用途にはテストドメインのままでも問題ありません)。
3. Dashboard → API Keys から API キーを発行する。
4. Worker にシークレットとして設定する:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   # プロンプトが出るので発行したAPIキーを貼り付けてEnter
   ```

5. `wrangler.jsonc` の `vars.RESEND_FROM_EMAIL` を、認証済みドメインの送信元アドレスに変更する
   (例: `"AI Skills Hub <no-reply@skills.example.com>"`)。未変更の場合はResendのテストドメインが
   使われます。

`RESEND_API_KEY` を設定していない場合、メールは実送信されず、確認リンク・リセットリンクを含む
本文がターミナルにログ出力されるだけになります(ローカル動作確認はこれで可能です)。

### 1-B. Cloudflare Email Service を使う場合(Workers Paidプラン限定)

1. Cloudflareダッシュボード → **Compute & AI → Email Service → Email Sending** を開き、
   「Onboard Domain」から送信元に使うドメインを選ぶ(そのドメインがCloudflare DNSで
   管理されている必要があります)。SPF/DKIM/DMARC/バウンス用MXレコードが自動追加されます
   (反映まで数分〜最大24時間)。
2. `wrangler.jsonc` の `send_email` バインディング(既定で `EMAIL` という名前で宣言済み)は
   そのままで問題ありません。
3. `wrangler.jsonc` の `vars` を以下のように設定する:

   ```jsonc
   "EMAIL_PROVIDER": "cloudflare",
   "EMAIL_FROM_ADDRESS": "AI Skills Hub <no-reply@skills.example.com>", // 手順1で認証したドメインのアドレス
   ```

4. デプロイする(`npm run deploy`)。Workers Freeプランのままデプロイ・利用しようとすると、
   実際の送信時に「メール送信は現在、Workers Paid プランでのみ利用可能です」というエラーになります。
   Paidプランへのアップグレードが必要です。

### ローカル開発時の挙動

- `EMAIL_PROVIDER=resend`(既定)かつ `RESEND_API_KEY` 未設定の場合: 実送信されず、ターミナルに
  確認リンク・リセットリンクを含む本文がログ出力されます。
- `EMAIL_PROVIDER=cloudflare` の場合: `wrangler dev` は既定で送信をローカルにシミュレートし、
  実際には送信せず `.wrangler/tmp/email/` 配下にHTML本文を保存します(内容を確認しながら
  開発できます)。実際に送信して試したい場合は `wrangler.jsonc` の `send_email` に
  `"remote": true` を追加してください([remote bindings](https://developers.cloudflare.com/workers/local-development/#remote-bindings))。

いずれの方式でも、`.dev.vars`(`.dev.vars.example` をコピーして使用)で `EMAIL_PROVIDER` を
上書きしてローカルでの挙動を切り替えられます。

### APP_BASE_URL(任意)

確認メール・パスワードリセットメール内のリンクは既定でリクエストのoriginを使います。
カスタムドメイン運用時など明示的に固定したい場合は `wrangler.jsonc` の `vars` に
`APP_BASE_URL` を追加してください(例: `"https://skills.example.com"`)。

## 2. 会員登録の受付範囲

`wrangler.jsonc` の `vars` で以下の2パターンを切り替えられます。

```jsonc
// パターンA: 誰でも登録可能(既定)
"REGISTRATION_MODE": "open",

// パターンB: 特定ドメインのメールアドレスのみ登録可能
"REGISTRATION_MODE": "domain_restricted",
"ALLOWED_EMAIL_DOMAINS": "example.co.jp,example2.co.jp",
```

`domain_restricted` のとき、`ALLOWED_EMAIL_DOMAINS` はカンマ区切りで複数指定できます。
一覧にないドメインのメールアドレスで登録しようとすると `403 domain_not_allowed` が返ります。

## 3. 会員登録・ログインの流れ(実装の概要)

- `POST /api/auth/register`: メール・パスワードを受け付け、確認メールを送信(この時点ではログインしない)
- `POST /api/auth/verify-email`: メール内リンクのトークンを検証し、メールアドレスを確認済みにする
- `POST /api/auth/login`: メールアドレスが確認済みの場合のみログイン可能。成功するとセッションCookieを発行
- `POST /api/auth/logout`: セッションを失効させる
- `POST /api/auth/request-password-reset` / `POST /api/auth/reset-password`: パスワード再設定
  (アカウントの有無に関わらず同じレスポンスを返し、登録メールアドレスの推測を防止)

パスワードは PBKDF2-SHA256(10万回。Cloudflare Workersの `crypto.subtle` における反復回数の上限)で
ハッシュ化して保存し、セッションはランダムトークンを発行してD1の `sessions` テーブルで管理します
(JWTではないため、ログアウトやパスワード変更時に即座に失効させられます)。登録・ログイン・
パスワードリセットには簡易的なレート制限もかかっています(`auth_attempts` テーブル、直近15分の
試行回数で制御)。

## MCPサーバーの認証

MCPクライアント(Claude Code / Claude Desktop等)はブラウザのセッションCookieを持てないため、
`/api/mcp` は個人アクセストークン(`Authorization: Bearer <トークン>` ヘッダー)でも認証できるように
なっています。トークンはログイン後、プロフィール編集画面から遷移できる「MCP用アクセストークン」
ページ(`/settings/tokens`)で発行・失効できます。詳細な接続手順は
[`docs/setup-mcp.md`](setup-mcp.md) を参照してください。
