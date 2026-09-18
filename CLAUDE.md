# AI Skills Hub — Claude Code 作業ルール

Cloudflare Workers (Hono) + D1 + R2 + React(Vite) 構成。自前のメール+パスワード認証を持つ。
詳細は `README.md` / `docs/` を参照。

## ⚠️ D1マイグレーションで絶対に守ること(重要・過去に実データ消失あり)

**背景**: `migrations/0010_external_items.sql` で `items` テーブルのCHECK制約を広げるために
`PRAGMA foreign_keys = OFF; ... DROP TABLE items; ... PRAGMA foreign_keys = ON;` という
再構築パターンを使ったところ、**`PRAGMA foreign_keys = OFF` がCloudflare D1では効かず**、
`DROP TABLE items` の暗黙DELETEがカスケード発火し、`item_tags`(タグ)・`favorites`(お気に入り)・
`item_watches`(更新通知購読)・`usage_events`(DL/コピー/訪問ログ)が **本番で全アイテム分消失した**。
(2026-09-17にローカルで実際に `wrangler d1 migrations apply` を使って再現・確認済み。
別プロセス・別リクエストで `PRAGMA foreign_keys = OFF` を単独発行しても、直後の別クエリで
`PRAGMA foreign_keys;` を見ると `1`(ON)のままだった。D1では接続がプールされるため、
セッション単位のPRAGMA設定は信頼できない。)

### ルール1: `PRAGMA foreign_keys = OFF` に安全性を依存しない

D1では効果が保証されない。**書いてもよいが、それだけで子テーブルが守られると考えないこと。**

### ルール2: `ON DELETE CASCADE` の親テーブルを再構築(DROP→RENAME)する時は、子テーブルを退避・復元する

SQLiteはCHECK制約などを`ALTER TABLE`で直接変更できないため、テーブル再構築(
`CREATE new → INSERT SELECT → DROP old → RENAME`)が必要になる場面がある。
その対象テーブルを外部キーで参照している(特に`ON DELETE CASCADE`が付いている)テーブルが
1つでもあれば、**必ず以下のパターンで子テーブルのデータを退避・復元すること**:

```sql
-- 1. 子テーブルを丸ごと退避(このマイグレーション内だけの一時テーブル)
CREATE TABLE _mig_backup_item_tags AS SELECT * FROM item_tags;
CREATE TABLE _mig_backup_favorites AS SELECT * FROM favorites;
CREATE TABLE _mig_backup_item_watches AS SELECT * FROM item_watches;
CREATE TABLE _mig_backup_usage_events AS SELECT * FROM usage_events;

-- 2. 親テーブル(items等)の再構築(CREATE new → INSERT SELECT → DROP old → RENAME)
--    この過程でカスケードが誤発火して子テーブルが空になっても、退避済みなので問題ない

-- 3. 子テーブルを退避データから復元(親の再構築完了後、子テーブル自体の再構築が必要な場合はそちらを先に行う)
INSERT INTO item_tags SELECT * FROM _mig_backup_item_tags;
INSERT INTO favorites SELECT * FROM _mig_backup_favorites;
INSERT INTO item_watches SELECT * FROM _mig_backup_item_watches;
INSERT INTO usage_events SELECT * FROM _mig_backup_usage_events;

-- 4. 一時テーブルを削除
DROP TABLE _mig_backup_item_tags;
DROP TABLE _mig_backup_favorites;
DROP TABLE _mig_backup_item_watches;
DROP TABLE _mig_backup_usage_events;
```

`PRAGMA foreign_keys = OFF/ON` は書いても書かなくても良いが、**退避・復元だけで安全性を担保する**。
退避・復元さえ入れておけば、カスケードが発火するかどうかに関係なく子テーブルのデータは必ず残る。

### ルール3: `items` を参照している現在のテーブル一覧(2026-09-17時点)

再構築で影響を受けうる子テーブル(すべて `ON DELETE CASCADE`):

- `item_tags`(タグ付け)
- `favorites`(お気に入り)
- `item_watches`(更新通知の購読・既読バージョン)
- `usage_events`(DL/コピー/訪問ログ。期間別ランキングと「同じ人の重複カウント防止」に使用)

新しいテーブルが `items(id)` を参照するようになったら、このリストにも追記すること。
`users` テーブルなど他の親テーブルについても同様に、再構築が必要になった際は参照している
子テーブルを洗い出してから着手すること(`grep -n "REFERENCES <table>" migrations/*.sql` で確認可能)。

### ルール4: テーブル再構築を伴うマイグレーションは、ローカルで「子テーブルにデータがある状態」で必ずテストする

新規作成した行だけで試すと(子テーブルが空のまま)カスケード消失に気づけない。また、新しい
マイグレーションファイルを `migrations/` に置いたまま `wrangler d1 migrations apply` を実行すると
未適用分がまとめて適用されてしまい、「適用前にテストデータを入れる」ことができない。
**対象のマイグレーションファイルを一時的に退避してから**、以下の手順で確認すること
(0010の事故をこの手順で実際に再現・確認済み):

```bash
# 1. ローカルDBをまっさらにし、テスト対象より後の(まだ書いていない/未検証の)マイグレーション
#    ファイルを一時的にどこかへ退避する(このファイル自体も含む場合はそれも退避)
rm -rf .wrangler/state
mkdir -p /tmp/migrations-holdout
mv migrations/00XX_this_migration.sql /tmp/migrations-holdout/   # 対象マイグレーション自身を退避

# 2. それ以前のマイグレーションだけを適用
npx wrangler d1 migrations apply ai-skills-hub-selfauth-db --local

# 3. 対象テーブル(例: items)とその子テーブルに最低1行ずつテストデータを入れる
npx wrangler d1 execute ai-skills-hub-selfauth-db --local --command "
INSERT INTO users (email, display_name) VALUES ('test@example.com', 'test');
INSERT INTO items (id, type, slug, title, author_email) VALUES ('t1', 'skill', 't1', 'test', 'test@example.com');
INSERT INTO item_tags (item_id, tag_id) SELECT 't1', id FROM tags LIMIT 1;
INSERT INTO favorites (user_email, item_id) VALUES ('test@example.com', 't1');
INSERT INTO item_watches (user_email, item_id, last_seen_version) VALUES ('test@example.com', 't1', '1.0.0');
INSERT INTO usage_events (item_id, user_email, kind) VALUES ('t1', 'test@example.com', 'download');
"

# 4. 退避したマイグレーションファイルを戻し、適用する(本番と同じコマンド経路)
mv /tmp/migrations-holdout/00XX_this_migration.sql migrations/
npx wrangler d1 migrations apply ai-skills-hub-selfauth-db --local

# 5. 全ての子テーブルの件数が0になっていないことを確認
npx wrangler d1 execute ai-skills-hub-selfauth-db --local --command "
SELECT 'items' t, COUNT(*) c FROM items
UNION ALL SELECT 'item_tags', COUNT(*) FROM item_tags
UNION ALL SELECT 'favorites', COUNT(*) FROM favorites
UNION ALL SELECT 'item_watches', COUNT(*) FROM item_watches
UNION ALL SELECT 'usage_events', COUNT(*) FROM usage_events;
"

# 6. テスト後、ローカルDBは作り直しておく(テストデータを残さない)
rm -rf .wrangler/state && npm run db:migrate:local
```

**1件でも0件になっていたら、そのマイグレーションを`db:migrate:remote`で本番に当ててはいけない。**
ルール2の退避・復元パターンを入れて修正してから再テストすること。

### 追記(2026-09-18): `items.type` / `usage_events.kind` のCHECK制約は撤去済み

`migrations/0012_drop_type_check_constraints.sql` で、この事故の直接の引き金だった
`items.type` / `usage_events.kind` のCHECK制約自体を撤去した(検証は元々アプリケーション層
(`worker/src/routes/items.ts`, `worker/src/mcp/tools.ts`)で厳密に行っており、DB制約は
実質的に冗長だった)。そのため、**今後 `items` に新しいtype(例: 5つ目の種別)を追加する際や
`usage_events` に新しいkindを追加する際は、テーブル再構築は不要**になった
(単にアプリケーション層の許容値リストに追加するだけでよい)。

ただし、ルール1〜4自体は将来また別の理由(NOT NULL列の追加でバックフィルが必要、他のCHECK制約の
追加、他テーブルの再構築等)でテーブル再構築が必要になった場合に備えて有効なまま残す。
再構築が必要になったら必ずこのルールに従うこと。

### ルール5: 一度 `db:migrate:remote` で本番に適用したマイグレーションファイルは、内容を書き換えない

適用済みのマイグレーションは再実行されないため、ファイルを直しても本番には反映されない。
不具合が見つかった場合は、そのマイグレーションを修正するのではなく、**新しい番号のマイグレーション**
(例: 0012_fix_xxx.sql)を追加して対応する。

## その他の運用ルール

- git: PRは作成せず、`main`ブランチへ直接コミット・pushする(ユーザーの標準運用)。
- 機密情報(APIキー等)は `wrangler.jsonc` の `vars` に書かず、`npx wrangler secret put <NAME>` で設定する。
  ローカル開発用のひな形は `.dev.vars.example` に追記する。
