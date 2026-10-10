-- メールアドレスを他の利用者に公開しないため、プロフィールURLや投稿者の表示に使う公開用IDを追加する。
-- (列の追加のみでテーブルの再構築は行わないため、items等の子テーブルへの影響はない)
ALTER TABLE users ADD COLUMN public_id TEXT;

-- 既存ユーザーに割り当てる(新規ユーザーには会員登録時にアプリ側で割り当てる)
UPDATE users SET public_id = lower(hex(randomblob(8))) WHERE public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);
