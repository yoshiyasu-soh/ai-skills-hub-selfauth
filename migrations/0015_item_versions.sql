-- 過去バージョンの参照機能。バージョンが自動的に上がるタイミング(0014後の運用)で、
-- 置き換えられる直前の内容をここにスナップショットとして退避する。
-- 新規テーブルの追加のみで、既存テーブルの再構築は伴わないためCLAUDE.mdの退避・復元は不要。
CREATE TABLE item_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '', -- type=promptの当時の本文。type=skillでは未使用
  r2_key TEXT, -- type=skillの当時の添付ファイルのR2キー。type=promptでは未使用
  file_name TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')) -- このバージョンが次のバージョンに置き換えられた日時
);

CREATE INDEX idx_item_versions_item_created ON item_versions(item_id, created_at);
