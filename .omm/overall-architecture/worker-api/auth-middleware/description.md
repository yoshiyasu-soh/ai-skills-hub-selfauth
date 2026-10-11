worker/src/auth.ts。Bearer トークン、/api/mcp 限定のクエリトークン、セッション Cookie の順で認証し、c.set("user") に AuthUser を設定する。トークンは SHA-256 ハッシュで api_tokens と照合し、最終利用日時を waitUntil で更新する。
