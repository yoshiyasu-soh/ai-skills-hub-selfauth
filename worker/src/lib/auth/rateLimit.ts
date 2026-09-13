import type { Env } from "../../types";

export type AuthAttemptKind = "register" | "login" | "password_reset";

const WINDOW_MINUTES = 15;
const LIMITS: Record<AuthAttemptKind, number> = {
  register: 5,
  login: 10,
  password_reset: 5,
};

/** 直近WINDOW_MINUTES分の試行回数が上限未満かどうかを返す(超えていたら呼び出し元は拒否する)。 */
export async function checkRateLimit(env: Env, kind: AuthAttemptKind, identifier: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM auth_attempts
     WHERE kind = ? AND identifier = ? AND created_at > datetime('now', '-${WINDOW_MINUTES} minutes')`,
  )
    .bind(kind, identifier)
    .first<{ count: number }>();

  return (row?.count ?? 0) < LIMITS[kind];
}

export async function recordAuthAttempt(env: Env, kind: AuthAttemptKind, identifier: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO auth_attempts (kind, identifier) VALUES (?, ?)`).bind(kind, identifier).run();
}
