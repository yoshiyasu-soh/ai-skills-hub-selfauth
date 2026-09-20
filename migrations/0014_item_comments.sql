-- 投稿(items)へのシンプルなコメントスレッド機能。
-- 新規テーブルの追加のみで、既存テーブルの再構築は伴わないためCLAUDE.mdの退避・復元は不要。
CREATE TABLE item_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_item_comments_item_created ON item_comments(item_id, created_at);
