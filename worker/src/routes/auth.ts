import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { checkRateLimit, recordAuthAttempt } from "../lib/auth/rateLimit";
import { isEmailDomainAllowed } from "../lib/auth/registration";
import {
  clearSessionCookie,
  createSession,
  destroyAllSessionsForUser,
  destroySession,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "../lib/auth/session";
import { generateToken, hashToken } from "../lib/auth/tokens";
import { fetchUserProfileRow, toUserProfileDTO } from "../lib/userProfile";
import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8, "パスワードは8文字以上で入力してください").max(72);

const registerSchema = z.object({ email: emailSchema, password: passwordSchema });
const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
const requestResetSchema = z.object({ email: emailSchema });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: passwordSchema });

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

interface UserAuthRow {
  email: string;
  password_hash: string | null;
  email_verified_at: string | null;
}

// ---- 会員登録: 確認メール送信までを行う。ログインは確認完了後。 ----
auth.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }
  const { email, password } = parsed.data;

  if (!isEmailDomainAllowed(c.env, email)) {
    return c.json({ error: "domain_not_allowed", message: "このメールアドレスのドメインは登録できません" }, 403);
  }

  const ip = clientIp(c);
  if (!(await checkRateLimit(c.env, "register", ip))) {
    return c.json({ error: "rate_limited", message: "しばらく時間をおいてから再度お試しください" }, 429);
  }
  await recordAuthAttempt(c.env, "register", ip);

  const existing = await c.env.DB.prepare(
    "SELECT email, password_hash, email_verified_at FROM users WHERE email = ?",
  )
    .bind(email)
    .first<UserAuthRow>();

  if (existing?.email_verified_at) {
    return c.json({ error: "already_registered", message: "このメールアドレスは既に登録されています" }, 409);
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    // 未確認のまま再登録された場合: パスワードを更新し確認メールを再送する
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE email = ?").bind(passwordHash, email).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO users (email, display_name, password_hash, created_at, last_seen_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    )
      .bind(email, email.split("@")[0], passwordHash)
      .run();
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);
  await c.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_email = ?").bind(email).run();
  await c.env.DB.prepare(
    `INSERT INTO email_verification_tokens (token_hash, user_email, expires_at)
     VALUES (?, ?, datetime('now', '+${EMAIL_VERIFICATION_TTL_HOURS} hours'))`,
  )
    .bind(tokenHash, email)
    .run();

  await sendVerificationEmail(c.env, c.req.url, email, token);

  return c.json({ ok: true, message: "確認メールを送信しました。メール内のリンクから登録を完了してください" });
});

// ---- メールアドレス確認 ----
auth.post("/verify-email", async (c) => {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

  const tokenHash = await hashToken(parsed.data.token);
  const row = await c.env.DB.prepare(
    "SELECT user_email FROM email_verification_tokens WHERE token_hash = ? AND expires_at > datetime('now')",
  )
    .bind(tokenHash)
    .first<{ user_email: string }>();

  if (!row) {
    return c.json({ error: "invalid_or_expired_token", message: "リンクが無効か有効期限が切れています" }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?")
    .bind(row.user_email)
    .run();
  await c.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_email = ?").bind(row.user_email).run();

  return c.json({ ok: true, email: row.user_email });
});

// ---- ログイン ----
auth.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }
  const { email, password } = parsed.data;

  if (!(await checkRateLimit(c.env, "login", email))) {
    return c.json({ error: "rate_limited", message: "しばらく時間をおいてから再度お試しください" }, 429);
  }
  await recordAuthAttempt(c.env, "login", email);

  const row = await c.env.DB.prepare("SELECT email, password_hash, email_verified_at FROM users WHERE email = ?")
    .bind(email)
    .first<UserAuthRow>();

  if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
    return c.json({ error: "invalid_credentials", message: "メールアドレスまたはパスワードが違います" }, 401);
  }

  if (!row.email_verified_at) {
    return c.json(
      { error: "email_not_verified", message: "メールアドレスの確認が完了していません" },
      403,
    );
  }

  await c.env.DB.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE email = ?").bind(email).run();

  const token = await createSession(c.env.DB, email);
  setSessionCookie(c, token);

  const profileRow = await fetchUserProfileRow(c.env.DB, email);
  return c.json({ user: toUserProfileDTO(profileRow!) });
});

// ---- ログアウト ----
auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await destroySession(c.env.DB, token);
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

// ---- パスワードリセット申請(アカウント有無に関わらず同じレスポンスを返す) ----
auth.post("/request-password-reset", async (c) => {
  const parsed = requestResetSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  const { email } = parsed.data;

  const genericResponse = () =>
    c.json({ ok: true, message: "登録されている場合、パスワード再設定メールを送信しました" });

  if (!(await checkRateLimit(c.env, "password_reset", email))) {
    return genericResponse();
  }
  await recordAuthAttempt(c.env, "password_reset", email);

  const row = await c.env.DB.prepare("SELECT email FROM users WHERE email = ? AND password_hash IS NOT NULL")
    .bind(email)
    .first<{ email: string }>();

  if (row) {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    await c.env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_email = ?").bind(email).run();
    await c.env.DB.prepare(
      `INSERT INTO password_reset_tokens (token_hash, user_email, expires_at)
       VALUES (?, ?, datetime('now', '+${PASSWORD_RESET_TTL_HOURS} hours'))`,
    )
      .bind(tokenHash, email)
      .run();
    await sendPasswordResetEmail(c.env, c.req.url, email, token);
  }

  return genericResponse();
});

// ---- パスワードリセット実行 ----
auth.post("/reset-password", async (c) => {
  const parsed = resetPasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }
  const { token, password } = parsed.data;

  const tokenHash = await hashToken(token);
  const row = await c.env.DB.prepare(
    "SELECT user_email FROM password_reset_tokens WHERE token_hash = ? AND expires_at > datetime('now')",
  )
    .bind(tokenHash)
    .first<{ user_email: string }>();

  if (!row) {
    return c.json({ error: "invalid_or_expired_token", message: "リンクが無効か有効期限が切れています" }, 400);
  }

  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE email = ?")
    .bind(passwordHash, row.user_email)
    .run();
  await c.env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_email = ?").bind(row.user_email).run();
  await destroyAllSessionsForUser(c.env.DB, row.user_email);

  return c.json({ ok: true });
});

export default auth;
