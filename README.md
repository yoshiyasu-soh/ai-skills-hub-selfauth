# AI Skills Hub

Claude Code のスキル・プロンプトを共有するためのサイトです。
Cloudflare Workers + D1 + R2 + React(Vite) で構築し、認証はWorker自身が提供する
メール+パスワードの会員登録・ログイン機能を利用します(外部IdPには依存しません)。

## 主な機能

- 会員登録・ログイン: メール+パスワードでの登録、メールアドレス確認、パスワード再設定に対応。
  登録受付範囲は「誰でも登録可」「特定ドメインのメールアドレスのみ」を設定で切替可能
- スキル投稿(ZIP または SKILL.md 単体のアップロード) / プロンプト投稿(テキスト)
  - SKILL.md を選択すると、フロントマター(`name`/`description`)と本文からタイトル等を自動入力
- 投稿の編集・削除(投稿者本人のみ)
- タグ機能: デフォルトタグ + 投稿者による新規タグ追加、複数タグでの絞り込み(AND条件)
- タイトル・説明文の文字列検索(部分一致)
- ソート: 新着順 / 利用数順(DL数・コピー数) / お気に入り数順 / 名前順
- お気に入り登録・お気に入り一覧
- DL数(スキル) / コピー数(プロンプト)の記録とランキング表示(累計・過去7日・過去30日)
- プロンプトはワンクリックでクリップボードにコピー、または claude.ai の新規チャットへ
  本文入力済みの状態で遷移(`https://claude.ai/new?q=...`)
- スキルはブラウザから直接ダウンロード
- ユーザープロフィール閲覧・編集: 表示名・姓名・会社名・役職・部署・従業員の種類を
  投稿者名などから誰でも閲覧可能。本人は自分のプロフィールを自由に編集可能
- MCP(Model Context Protocol)サーバー: `/api/mcp` にエンドポイントを実装済み。ただし
  Cloudflare Access のOAuth連携を前提としていたため、Access廃止に伴い外部MCPクライアントからの
  接続は現状未対応(詳細は [`docs/setup-mcp.md`](docs/setup-mcp.md))

## アーキテクチャ

```
ブラウザ
        │  会員登録・ログイン(メール+パスワード) / セッションCookie
        ▼
Cloudflare Workers (Hono)  ──/api/*──▶  D1 (メタデータ) / R2 (スキルZIP)
        │                                    │
        │                                    └─▶ Resend (確認メール・パスワードリセットメール送信)
        └─/以外─▶ 静的アセット(React/Vite ビルド成果物, SPA)
```

- `worker/` : Hono ベースの API。`/api/auth/*` で会員登録・ログイン・パスワードリセットを提供し、
  発行したセッションCookieを他の `/api/*` エンドポイントで検証します。
- `frontend/` : React + Vite + Tailwind CSS の SPA。
- `migrations/` : D1(SQLite)のスキーマ定義。
- `wrangler.jsonc` : Worker 本体、D1/R2 バインディング、静的アセット配信の設定。

パスワードは PBKDF2-SHA256 でハッシュ化して保存し、セッションはD1で管理するランダムトークン方式
(JWTではない)のため、ログアウトやパスワード変更時に即座に失効させられます。

## セットアップ

1. [`docs/setup-cloudflare.md`](docs/setup-cloudflare.md) — D1/R2 作成、デプロイ
2. [`docs/setup-selfauth.md`](docs/setup-selfauth.md) — メール送信(Resend)・会員登録受付範囲の設定
3. (任意) [`docs/setup-mcp.md`](docs/setup-mcp.md) — MCPサーバーについて(現状の制約を含む)

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local

# ターミナル1
npx wrangler dev

# ターミナル2
npm run dev:frontend
```

`RESEND_API_KEY` 未設定の場合、確認メール・パスワードリセットメールはターミナルにログ出力される
だけになります。詳細は [`docs/setup-selfauth.md`](docs/setup-selfauth.md) を参照してください。

## 今後の拡張候補(今回のスコープ外)

- `npx skills add <name>` のような CLI 配布(現状は ZIP/SKILL.md 一括ダウンロードのみ対応)
- GenU など他ツールへのワンクリック連携(現状はクリップボードコピーのみ対応)
- コメント・レビュー機能
- 投稿の承認フロー / モデレーション
- トークンベース認証による外部MCPクライアント(Claude Desktop等)からの `/api/mcp` 接続対応
