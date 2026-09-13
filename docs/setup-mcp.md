# MCP(Model Context Protocol)サーバー化

AI Skills Hub は `/api/mcp` に MCP エンドポイントを持ち、Claude Code / Claude Desktop などの
MCPクライアントから直接、投稿されているスキル・プロンプトを検索・参照できます。

**現状のスコープ: 参照系(検索・取得)のみ**。投稿・編集・お気に入り・DL数カウント等の
書き込み系操作は未対応です(今後の拡張候補)。

## 認証: 個人アクセストークン

`/api/mcp` を含む `/api/*` はセッションCookie(ブラウザログイン)で保護されていますが、
MCPクライアントはブラウザセッションを持てません。そのため `/api/mcp` は
`Authorization: Bearer <トークン>` ヘッダーでの認証にも対応しています。

トークンは AI Skills Hub にログイン後、プロフィール編集画面(`/settings/profile`)から
遷移できる「MCP用アクセストークン」ページ(`/settings/tokens`)で発行します。

- 発行した生のトークンはその場でしか表示されません(DBにはハッシュ値のみ保存)。必ずコピーして
  安全な場所に保管してください。
- トークンには有効期限はありません。不要になった場合や漏洩した疑いがある場合は、同じページから
  いつでも失効できます。
- 失効すると、そのトークンを使っているすべての接続が即座に使えなくなります。

## 提供しているツール(読み取り専用)

| ツール名 | 内容 |
|---|---|
| `search_items` | キーワード・種別(skill/prompt)・タグ名・並び順で検索 |
| `get_item` | 指定IDの詳細(概要・詳細説明・プロンプト本文 または 使い方メモ・タグ・作者等)を取得 |
| `list_tags` | 絞り込みに使えるタグ一覧(名前・利用件数)を取得 |
| `get_skill_source` | SKILL.md単体形式のスキルの本文をテキストで取得(ZIP形式は非対応。Webサイトからダウンロードしてください) |

投稿・お気に入り登録・DL数カウント等は行わないため、MCP経由でアイテムを閲覧しても
一覧画面の利用数(users)やお気に入り数は変化しません。

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
4. 「Advanced settings」にカスタムヘッダーを指定できる欄がある場合、キーに `Authorization`、
   値に `Bearer <手順1で発行したトークン>` を入力して「Add」を押す。

   > Claude Desktopのバージョンによっては、カスタムヘッダーを指定する欄が用意されていないことが
   > あります。その場合、現時点ではこの方法でのClaude Desktop接続には対応していません
   > (Claude Codeでの接続をご検討ください)。

5. Connectorsの一覧で状態が「Connected」になっていれば接続完了です。

## うまくつながらないとき

「Unauthorized」「401」のようなエラーが出る場合、以下を確認してください。

- トークンの入力ミス(`Bearer` の後ろの半角スペース、コピー漏れ等)がないか
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

- 投稿・編集・お気に入り登録・DL/コピーのカウント連携など、書き込み系ツールの追加
  (誤操作防止のため、確認ステップや権限スコープの設計が別途必要)
- `list_ranking` など補助的な参照ツールの追加
- トークンへの有効期限・スコープ(参照専用/書き込み可等)の付与
