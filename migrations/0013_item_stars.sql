-- OSS紹介投稿(type='external')のGitHubスター数を保存する。
-- 投稿時(または編集時)にGitHub APIから取得した値のスナップショットであり、自動更新はされない。
-- 単純な列追加のみで、テーブル再構築は不要(CLAUDE.md参照)。
ALTER TABLE items ADD COLUMN stars INTEGER;
