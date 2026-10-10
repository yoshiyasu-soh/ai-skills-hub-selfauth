import type { Env } from "../../types";

export type AuthAttemptKind = "register" | "login" | "password_reset";

const WINDOW_MINUTES = 15;
const LIMITS: Record<AuthAttemptKind, number> = {
  register: 5,
  login: 10,
  password_reset: 5,
};

// ログインは「アカウント×IP」単位(LIMITS.login)に加え、1つのIPから多数のアカウントを試す
// 総当たり(パスワードスプレー)を止めるためのIP単位の上限を設ける。
export const LOGIN_PER_IP_LIMIT = 30;

// パスワード再設定メールは、メールアドレス単位(LIMITS.password_reset)に加え、1つのIPから多数のアドレスへ
// 送らせる乱用(メール送信上限の枯渇)を止めるためのIP単位の上限を設ける。
export const PASSWORD_RESET_PER_IP_LIMIT = 10;

/**
 * 直近WINDOW_MINUTES分の試行回数が上限未満かどうかを返す(超えていたら呼び出し元は拒否する)。
 * limit を省略した場合は kind ごとの既定値を使う。
 */
export async function checkRateLimit(
  env: Env,
  kind: AuthAttemptKind,
  identifier: string,
  limit = LIMITS[kind],
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM auth_attempts
     WHERE kind = ? AND identifier = ? AND created_at > datetime('now', '-${WINDOW_MINUTES} minutes')`,
  )
    .bind(kind, identifier)
    .first<{ count: number }>();

  return (row?.count ?? 0) < limit;
}

export async function recordAuthAttempt(env: Env, kind: AuthAttemptKind, identifier: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO auth_attempts (kind, identifier) VALUES (?, ?)`).bind(kind, identifier).run();
}
