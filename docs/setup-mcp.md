# MCP(Model Context Protocol)サーバー化

AI Skills Hub は `/api/mcp` に MCP エンドポイントを持ち、Claude Code / Claude Desktop などの
MCPクライアントから直接、投稿されているスキル・プロンプトを検索・参照できます。

参照系(検索・取得)に加え、投稿・編集・お気に入り登録の書き込み系操作にも対応しています。
ただし、スキルのZIP形式の資産アップロード/差し替えはMCPのテキストベースの入力では扱えないため、
`create_item`/`update_item` で投稿・編集できるスキルはSKILL.md単体形式(テキスト)のみです
(ZIP形式のスキルの投稿・資産差し替えはWebサイトから行ってください)。

## 認証: 個人アクセストークン

`/api/mcp` を含む `/api/*` はセッションCookie(ブラウザログイン)で保護されていますが、
MCPクライアントはブラウザセッションを持てません。そのため `/api/mcp` は以下2通りの
個人アクセストークン認証にも対応しています。

- `Authorization: Bearer <トークン>` ヘッダー(Claude Code、Claude Desktop等)
- `?token=<トークン>` クエリパラメータ(リクエストヘッダーを設定できないクライアント向けの代替手段。
  `/api/mcp` に限り対応)

トークンは AI Skills Hub にログイン後、プロフィール編集画面(`/settings/profile`)から
遷移できる「MCP用アクセストークン」ページ(`/settings/tokens`)で発行します。

- 発行した生のトークンはその場でしか表示されません(DBにはハッシュ値のみ保存)。必ずコピーして
  安全な場所に保管してください。
- 発行時に有効期限(無期限/30日/90日/180日/365日)を選べます。既定は無期限ですが、
  漏洩リスクを抑えるため、長期間使わない予定の接続には有効期限の設定を推奨します。
- 期限切れのトークンを使った接続は自動的に401 Unauthorizedになります。不要になった場合や
  漏洩した疑いがある場合は、`/settings/tokens` からいつでも手動で失効させることもできます。
- 失効(または期限切れ)すると、そのトークンを使っているすべての接続が即座に使えなくなります。

## 提供しているツール

### 参照系

| ツール名 | 内容 |
|---|---|
| `search_items` | キーワード・種別(skill/prompt/external)・タグ名・並び順で検索 |
| `get_item` | 指定IDの詳細(概要・詳細説明・プロンプト本文/使い方メモ/外部紹介情報・タグ・作者等)を取得 |
| `list_tags` | 絞り込みに使えるタグ一覧(名前・利用件数)を取得 |
| `get_skill_source` | SKILL.md単体形式のスキルの本文をテキストで取得(ZIP形式は非対応。Webサイトからダウンロードしてください) |

### 書き込み系

| ツール名 | 内容 |
|---|---|
| `create_item` | 新規投稿(skill/prompt/external)。type=skillはSKILL.md単体形式のみ、タグは名前指定で既存タグに紐付けるか無ければ新規作成する |
| `update_item` | 自分の投稿を編集(指定したフィールドのみ更新)。ZIP形式のスキル資産の差し替えは不可 |
| `set_item_favorite` | 指定アイテムのお気に入り登録/解除 |

DL数・コピー数・訪問数のカウントはMCPからは操作できません(ダウンロード・コピー・紹介元を見る、
という「実際に中身を利用した」操作をWebサイト上で行った際にのみ計測されます)。

## Claude Code から接続する

1. AI Skills Hub にログインし、`/settings/tokens` でトークンを発行してコピーする。
2. ターミナルで以下を実行する(`<トークン>` は手順1でコピーした値に置き換える):

   ```bash
   claude mcp add --transport http ai-skills-hub-selfauth https://<あなたのWorkerの公開ドメイン>/api/mcp --header "Authorization: Bearer <トークン>"
   ```

   **`--header` は必ず `name` とURLの後ろに置いてください。** `--header` は複数の値を取れる
   オプションのため、前に置くと `name`・URLまで値として読み込まれてしまい、
   `error: missing required argument 'name'` のようなエラーになります。
   詳細は `claude mcp add --help` で確認できます。

3. Claude Codeで `/mcp` を実行し、`ai-skills-hub-selfauth` が `Connected` と表示されれば接続完了です。

## Claude Desktop から接続する

1. AI Skills Hub にログインし、`/settings/tokens` でトークンを発行してコピーする。
2. Claude Desktopの設定(`Ctrl + ,` / `Cmd + ,`)→「Connectors」→「Add custom connector」を開く。
3. 「Name」に任意の名前、「URL」に `https://<あなたのWorkerの公開ドメイン>/api/mcp` を入力する。
4. 「認証」で **サインインなし** を選択する。
5. 「リクエストヘッダー」で、キーに `authorization`、値に `Bearer <トークン>`
   (`<トークン>` は手順1でコピーした値に置き換える。`Bearer ` を含めて入力する)を入力して
   「追加」を押す。
6. Connectorsの一覧で状態が「Connected」になっていれば接続完了です。

> リクエストヘッダーの入力欄が見当たらないバージョンの場合は、代わりにURLの末尾へ
> `?token=<トークン>` を付け足す方法でも接続できます
> (例: `https://<あなたのWorkerの公開ドメイン>/api/mcp?token=<トークン>`)。

## うまくつながらないとき

「Unauthorized」「401」、またはClaude Desktopの「サーバーに接続できませんでした」のような
エラーが出る場合、以下を確認してください。

- Claude Codeの場合: `Authorization: Bearer <トークン>` の `Bearer` の後ろの半角スペースや
  コピー漏れがないか
- Claude Desktopの場合: URLの末尾が `?token=<トークン>` になっているか、トークンの前後に
  余計な空白・改行が入っていないか
- `/settings/tokens` でそのトークンが失効済みになっていないか

解決しない場合は、新しいトークンを発行し直して設定を作り直すのが確実です。

## ローカルでの動作確認(参考)

```bash
npx wrangler dev

curl -X POST http://localhost:8787/api/mcp \
  -H "Authorization: Bearer <ローカルで発行したトークン>" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 今後の拡張(スコープ外)

- `list_ranking` など補助的な参照ツールの追加
- トークンへのスコープ(参照専用/書き込み可等)の付与(有効期限は対応済み)
- 削除(delete_item)など、より破壊的な書き込み操作への対応(誤操作防止の設計が別途必要)
