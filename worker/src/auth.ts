import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE_NAME } from "./lib/auth/session";
import { hashToken } from "./lib/auth/tokens";
import type { AuthUser, Env } from "./types";

type AppContext = Context<{ Bindings: Env; Variables: { user: AuthUser } }>;

/**
 * ログイン時に発行したセッションCookieを検証し、Hono contextにuserを積む。
 * `/api/auth/*` (登録・ログイン等)はこのミドルウェアの対象外(index.tsで先に分岐)。
 */
export async function authMiddleware(c: AppContext, next: Next) {
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
