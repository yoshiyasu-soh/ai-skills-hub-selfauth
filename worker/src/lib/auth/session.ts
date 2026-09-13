import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Env } from "../../types";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_DAYS = 30;

export async function createSession(db: D1Database, email: string): Promise<string> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, user_email, expires_at)
       VALUES (?, ?, datetime('now', '+${SESSION_TTL_DAYS} days'))`,
    )
    .bind(tokenHash, email)
    .run();
  return token;
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

/** パスワード変更時など、そのユーザーの既存セッションを全て失効させる */
export async function destroyAllSessionsForUser(db: D1Database, email: string): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE user_email = ?`).bind(email).run();
}

export function setSessionCookie(c: Context<{ Bindings: Env }>, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}
