-- 会員編集機能: 表示名以外のプロフィール項目(自己申告)を追加する。
-- Entra ID連携時とは異なり、これらはユーザー自身が /api/me (PATCH) で編集する。

ALTER TABLE users ADD COLUMN given_name TEXT;
ALTER TABLE users ADD COLUMN surname TEXT;
ALTER TABLE users ADD COLUMN company_name TEXT;
ALTER TABLE users ADD COLUMN job_title TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN employee_type TEXT;
