-- type=skill のアイテムを Claude Code プラグイン(.claude-plugin/plugin.json + skills/*)形式の
-- zipに変換した結果をキャッシュするための列を items に追加する。
-- plugin_archive_source_r2_key は「このキャッシュがどの時点の r2_key を元に作られたか」を記録し、
-- items.r2_key が更新された(=スキル本体が差し替えられた)ときにキャッシュを無効化する判定に使う。
-- 単純な ALTER TABLE ADD COLUMN のみで、テーブル再構築(DROP/RENAME)を伴わないため
-- CLAUDE.md記載の子テーブル退避ルールの対象外。
ALTER TABLE items ADD COLUMN plugin_archive_r2_key TEXT;
ALTER TABLE items ADD COLUMN plugin_archive_sha256 TEXT;
ALTER TABLE items ADD COLUMN plugin_archive_source_r2_key TEXT;
