-- MCPクライアント(Claude Code / Claude Desktop等)からの接続用個人アクセストークン。
-- セッションCookieを使えない外部クライアント向けの認証手段として、
-- Authorization: Bearer <token> ヘッダーでの認証を authMiddleware に追加する。

CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_email);
