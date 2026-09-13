# 会員登録機能(自前認証)のセットアップ

このリポジトリは Cloudflare Access(Entra ID SSO)に依存せず、Worker自身がメール+パスワードでの
会員登録・ログインを提供します。認証まわりで追加設定が必要なのは以下の2点だけです。

1. メール送信(Resend)の設定
2. 会員登録の受付範囲の設定(誰でも登録可 / 特定ドメインのみ)

## 1. Resend の設定(確認メール・パスワードリセットメールの送信)

Cloudflare Workers は SMTP を直接扱えないため、確認メール・パスワードリセットメールの送信には
[Resend](https://resend.com/) の HTTP API を使用します。

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

6. (任意)確認メール・パスワードリセットメール内のリンクは既定でリクエストのoriginを使います。
   カスタムドメイン運用時など明示的に固定したい場合は `wrangler.jsonc` の `vars` に
   `APP_BASE_URL` を追加してください(例: `"https://skills.example.com"`)。

### ローカル開発時の挙動

`RESEND_API_KEY` を設定していない場合、メールは実送信されず、確認リンク・リセットリンクを含む
本文がターミナルにログ出力されるだけになります。ローカルではこのログからリンクをコピーして
動作確認してください(`.dev.vars` に `RESEND_API_KEY` を設定すれば実送信も試せます)。

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

パスワードは PBKDF2-SHA256(21万回)でハッシュ化して保存し、セッションはランダムトークンを
発行してD1の `sessions` テーブルで管理します(JWTではないため、ログアウトやパスワード変更時に
即座に失効させられます)。登録・ログイン・パスワードリセットには簡易的なレート制限もかかっています
(`auth_attempts` テーブル、直近15分の試行回数で制御)。

## 既知の制約

- MCPサーバー(`/api/mcp`、[`docs/setup-mcp.md`](setup-mcp.md))はブラウザセッションを前提とした
  Cloudflare Access の OAuth連携を利用していたため、Access を廃止した本バージョンでは
  外部MCPクライアント(Claude Desktop等)からの接続は現状サポートしていません(今後の拡張候補)。
