-- 個人アクセストークン(api_tokens)に有効期限を追加する。
-- NULL = 無期限(既存トークンは全てNULLのまま、挙動は変わらない)。
ALTER TABLE api_tokens ADD COLUMN expires_at TEXT;
