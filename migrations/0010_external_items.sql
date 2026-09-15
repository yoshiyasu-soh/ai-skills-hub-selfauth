-- 既に公開されているOSS等を「紹介」として登録できる新しいアイテム種別 'external' を追加する。
-- ファイルはホストせず、紹介先URL(source_url)へのリンクのみを保持する。
-- items.type / usage_events.kind はCHECK制約付きのため、テーブルを再構築して制約を更新する。

PRAGMA foreign_keys = OFF;

CREATE TABLE items_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('skill', 'prompt', 'external')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '', -- prompt text (type='prompt') or usage notes (type='skill')
  r2_key TEXT, -- skill zip object key in R2; null for prompts/external
  file_name TEXT,
  file_size INTEGER,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author_email TEXT NOT NULL REFERENCES users(email),
  usage_count INTEGER NOT NULL DEFAULT 0, -- downloads (skill) / copies (prompt) / visits (external)
  favorite_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT, -- type='external' の紹介先URL
  source_author TEXT, -- 元の作者/組織名(任意, 自己申告)
  license TEXT -- ライセンス(任意, 自己申告のテキスト)
);

INSERT INTO items_new (
  id, type, slug, title, summary, description, body, r2_key, file_name, file_size,
  version, author_email, usage_count, favorite_count, created_at, updated_at
)
SELECT
  id, type, slug, title, summary, description, body, r2_key, file_name, file_size,
  version, author_email, usage_count, favorite_count, created_at, updated_at
FROM items;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_usage_count ON items(usage_count);
CREATE INDEX IF NOT EXISTS idx_items_author ON items(author_email);

CREATE TABLE usage_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_email TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('download', 'copy', 'visit')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO usage_events_new (id, item_id, user_email, kind, created_at)
SELECT id, item_id, user_email, kind, created_at FROM usage_events;

DROP TABLE usage_events;
ALTER TABLE usage_events_new RENAME TO usage_events;

CREATE INDEX IF NOT EXISTS idx_usage_events_item_created ON usage_events(item_id, created_at);

PRAGMA foreign_keys = ON;
