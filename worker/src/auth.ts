import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE_NAME } from "./lib/auth/session";
import { hashToken } from "./lib/auth/tokens";
import type { AuthUser, Env } from "./types";

type AppContext = Context<{ Bindings: Env; Variables: { user: AuthUser } }>;

/**
 * 認証は2通り:
 * 1. ブラウザからのセッションCookie(ログイン時に発行)
 * 2. `Authorization: Bearer <token>` ヘッダー(MCPクライアント等、Cookieを使えない外部クライアント向けの
 *    個人アクセストークン。/api/me/tokens で発行・失効を管理する)
 * `/api/auth/*` (登録・ログイン等)はこのミドルウェアの対象外(index.tsで先に分岐)。
 */
export async function authMiddleware(c: AppContext, next: Next) {
  const bearer = c.req.header("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (bearer) {
    const tokenHash = await hashToken(bearer);
    const row = await c.env.DB.prepare(
      `SELECT a.user_email as email, u.display_name as display_name
       FROM api_tokens a
       JOIN users u ON u.email = a.user_email
       WHERE a.token_hash = ?`,
    )
      .bind(tokenHash)
      .first<{ email: string; display_name: string }>();

    if (!row) {
      return c.json({ error: "unauthorized" }, 401);
    }

    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE token_hash = ?")
        .bind(tokenHash)
        .run(),
    );

    c.set("user", { email: row.email, displayName: row.display_name });
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const tokenHash = await hashToken(token);
  const session = await c.env.DB.prepare(
    `SELECT s.user_email as email, u.display_name as display_name
     FROM sessions s
     JOIN users u ON u.email = s.user_email
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
  )
    .bind(tokenHash)
    .first<{ email: string; display_name: string }>();

  if (!session) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("user", { email: session.email, displayName: session.display_name });
  await next();
}
