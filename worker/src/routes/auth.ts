import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import {
  checkRateLimit,
  LOGIN_PER_IP_LIMIT,
  PASSWORD_RESET_PER_IP_LIMIT,
  recordAuthAttempt,
} from "../lib/auth/rateLimit";
import { verifyTurnstile } from "../lib/auth/turnstile";
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
import { fetchUserProfileRow, generatePublicId, toUserProfileDTO } from "../lib/userProfile";
import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8, "パスワードは8文字以上で入力してください").max(72);

// 登録時はメールアドレスだけを受け付け、パスワードと表示名は確認リンクを開いた本人が設定する。
// (登録時にパスワードを受け取ると、未確認のアドレスへ第三者が再登録してパスワードを差し替え、
//  本人が確認リンクを押した時点で第三者のパスワードのまま有効化される「事前乗っ取り」が成立するため)
const registerSchema = z.object({ email: emailSchema });
const verifyEmailSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  displayName: z.string().trim().min(1, "表示名を入力してください").max(100),
});
const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
const requestResetSchema = z.object({ email: emailSchema });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: passwordSchema });

// 確認前のアカウントの仮の表示名。確認時に本人が設定し直す(メールアドレス由来の値は使わない)。
const PENDING_DISPLAY_NAME = "未設定";

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

interface UserAuthRow {
  email: string;
  password_hash: string | null;
  email_verified_at: string | null;
}

/** リクエスト本文に含まれる Turnstile のトークン(ウィジェットが発行し、画面から送られる) */
function turnstileTokenOf(body: unknown): unknown {
  return typeof body === "object" && body !== null ? (body as { turnstileToken?: unknown }).turnstileToken : undefined;
}

const BOT_CHECK_FAILED = {
  error: "bot_check_failed",
  message: "ボット対策の確認ができませんでした。もう一度お試しください",
} as const;

// ---- 画面の初期化に使う公開設定(Turnstileのサイトキー。未設定なら null = ボット対策なし) ----
auth.get("/config", (c) => c.json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null }));

// ---- 会員登録: 確認メール送信までを行う。ログインは確認完了後。 ----
auth.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }
  const { email } = parsed.data;

  // 確認メールを任意のアドレスへ大量に送らせる乱用(送信上限の枯渇・送信ドメインの評判低下)を防ぐ
  if (!(await verifyTurnstile(c.env, turnstileTokenOf(body), "signup", clientIp(c)))) {
    return c.json(BOT_CHECK_FAILED, 403);
  }

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

  // 未確認のまま再登録された場合は、アカウントには触れず確認メールだけを再送する
  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO users (email, display_name, public_id, created_at, last_seen_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
    )
      .bind(email, PENDING_DISPLAY_NAME, generatePublicId())
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

// ---- メールアドレス確認(確認リンクを開いた本人が、ここでパスワードと表示名を設定する) ----
auth.post("/verify-email", async (c) => {
  const parsed = verifyEmailSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }

  const tokenHash = await hashToken(parsed.data.token);
  const row = await c.env.DB.prepare(
    "SELECT user_email FROM email_verification_tokens WHERE token_hash = ? AND expires_at > datetime('now')",
  )
    .bind(tokenHash)
    .first<{ user_email: string }>();

  if (!row) {
    return c.json({ error: "invalid_or_expired_token", message: "リンクが無効か有効期限が切れています" }, 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, display_name = ?, email_verified_at = datetime('now') WHERE email = ?",
  )
    .bind(passwordHash, parsed.data.displayName, row.user_email)
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

  // メールアドレス単位だけで数えると、第三者がわざと失敗を重ねて本人を締め出せるため、
  // 「アカウント×IP」単位と「IP」単位で数える
  const ip = clientIp(c);
  const accountKey = `${email}|${ip}`;
  const ipKey = `ip:${ip}`;
  if (
    !(await checkRateLimit(c.env, "login", accountKey)) ||
    !(await checkRateLimit(c.env, "login", ipKey, LOGIN_PER_IP_LIMIT))
  ) {
    return c.json({ error: "rate_limited", message: "しばらく時間をおいてから再度お試しください" }, 429);
  }
  await recordAuthAttempt(c.env, "login", accountKey);
  await recordAuthAttempt(c.env, "login", ipKey);

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
  const body = await c.req.json().catch(() => ({}));
  const parsed = requestResetSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  const { email } = parsed.data;

  const ip = clientIp(c);
  if (!(await verifyTurnstile(c.env, turnstileTokenOf(body), "password_reset", ip))) {
    return c.json(BOT_CHECK_FAILED, 403);
  }

  const genericResponse = () =>
    c.json({ ok: true, message: "登録されている場合、パスワード再設定メールを送信しました" });

  // メールアドレス単位に加え、1つのIPから多数のアドレスへ送らせる乱用もIP単位で止める
  // (どちらも、アカウントの有無を推測されないよう同じ応答を返して送信だけを止める)
  const ipKey = `ip:${ip}`;
  if (
    !(await checkRateLimit(c.env, "password_reset", email)) ||
    !(await checkRateLimit(c.env, "password_reset", ipKey, PASSWORD_RESET_PER_IP_LIMIT))
  ) {
    return genericResponse();
  }
  await recordAuthAttempt(c.env, "password_reset", email);
  await recordAuthAttempt(c.env, "password_reset", ipKey);

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
  // 乗っ取られたアカウントを取り戻す操作でもあるため、第三者が発行した可能性のある個人アクセストークンも失効させる
  await c.env.DB.prepare("DELETE FROM api_tokens WHERE user_email = ?").bind(row.user_email).run();

  return c.json({ ok: true });
});

export default auth;
