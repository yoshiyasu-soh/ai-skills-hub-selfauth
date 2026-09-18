-- items.type / usage_events.kind のCHECK制約を撤去する。
--
-- 背景: SQLiteはCHECK制約をALTER TABLEで直接変更できないため、これまで新しいtype/kindを
-- 追加するたびにテーブル再構築(CREATE new → INSERT SELECT → DROP old → RENAME)が必要だった。
-- 0010で実際にこの再構築が原因で item_tags/favorites/item_watches/usage_events が
-- 全アイテム分消失する事故が発生している(CLAUDE.md参照)。
--
-- 対応: 検証は既にアプリケーション層(worker/src/routes/items.ts, mcp/tools.ts)で
-- type/kindの許容値を厳密にチェックしており、DB側のCHECK制約は実質的に冗長だった。
-- この制約を撤去することで、今後type/kindの値を増やす際にテーブル再構築が二度と
-- 不要になり、このクラスの事故を構造的に防止する。
-- (このマイグレーション自体は最後の再構築になるため、CLAUDE.mdの退避・復元パターンを
-- 適用し、item_tags/favorites/item_watches/usage_eventsのデータを保護する)

PRAGMA foreign_keys = OFF;

-- 1. カスケード削除で消える恐れのある子テーブルを退避する
CREATE TABLE _mig_backup_item_tags AS SELECT * FROM item_tags;
CREATE TABLE _mig_backup_favorites AS SELECT * FROM favorites;
CREATE TABLE _mig_backup_item_watches AS SELECT * FROM item_watches;
CREATE TABLE _mig_backup_usage_events AS SELECT * FROM usage_events;

-- 2. items を CHECK制約なしで再構築する
CREATE TABLE items_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- CHECK制約は撤去。許容値の検証はアプリケーション層のみで行う。
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  r2_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author_email TEXT NOT NULL REFERENCES users(email),
  usage_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT,
  source_author TEXT,
  license TEXT
);

INSERT INTO items_new (
  id, type, slug, title, summary, description, body, r2_key, file_name, file_size,
  version, author_email, usage_count, favorite_count, created_at, updated_at,
  source_url, source_author, license
)
SELECT
  id, type, slug, title, summary, description, body, r2_key, file_name, file_size,
  version, author_email, usage_count, favorite_count, created_at, updated_at,
  source_url, source_author, license
FROM items;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_usage_count ON items(usage_count);
CREATE INDEX IF NOT EXISTS idx_items_author ON items(author_email);

-- 3. usage_events を CHECK制約なしで再構築する。
--    注意: usage_events は items の子テーブル(ON DELETE CASCADE)であると同時に、
--    ここ自身も再構築対象になっている。手順2のDROP TABLE itemsでカスケード削除が
--    発火するかどうかに関わらず結果を決定的にするため、ここでは生テーブルからは
--    コピーせず空のテーブルとして作り直し、手順4で退避データからのみ復元する
--    (発火有無に依存すると、発火しなかった場合に二重挿入になり得るため)。
CREATE TABLE usage_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_email TEXT,
  kind TEXT NOT NULL, -- CHECK制約は撤去。許容値の検証はアプリケーション層のみで行う。
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

DROP TABLE usage_events;
ALTER TABLE usage_events_new RENAME TO usage_events;

CREATE INDEX IF NOT EXISTS idx_usage_events_item_created ON usage_events(item_id, created_at);

-- 4. 退避データを復元する(手順2・3の再構築でカスケード削除が誤発火していても、
--    ここで必ず元通りに復元される。usage_eventsは手順3で意図的に空にしているため
--    二重挿入は発生しない)
INSERT INTO item_tags SELECT * FROM _mig_backup_item_tags;
INSERT INTO favorites SELECT * FROM _mig_backup_favorites;
INSERT INTO item_watches SELECT * FROM _mig_backup_item_watches;
INSERT INTO usage_events SELECT * FROM _mig_backup_usage_events;

DROP TABLE _mig_backup_item_tags;
DROP TABLE _mig_backup_favorites;
DROP TABLE _mig_backup_item_watches;
DROP TABLE _mig_backup_usage_events;

PRAGMA foreign_keys = ON;
