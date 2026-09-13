-- Cloudflare Access (Entra ID SSO) を廃止し、自前のメール+パスワード認証へ移行するための変更。

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Entra ID / Microsoft Graph 連携専用だった列は、連携自体を廃止したため削除する。
ALTER TABLE users DROP COLUMN given_name;
ALTER TABLE users DROP COLUMN surname;
ALTER TABLE users DROP COLUMN job_title;
ALTER TABLE users DROP COLUMN company_name;
ALTER TABLE users DROP COLUMN department;
ALTER TABLE users DROP COLUMN employee_type;
ALTER TABLE users DROP COLUMN profile_synced_at;
ALTER TABLE users DROP COLUMN user_type;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_email);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_email);

-- 登録・ログイン・パスワードリセットへの簡易レート制限用
CREATE TABLE IF NOT EXISTS auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('register', 'login', 'password_reset')),
  identifier TEXT NOT NULL, -- email または IP
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup ON auth_attempts(kind, identifier, created_at);
