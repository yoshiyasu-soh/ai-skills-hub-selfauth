import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/lib/auth/password";
import { createSession } from "../src/lib/auth/session";
import { generateToken, hashToken } from "../src/lib/auth/tokens";

const EMAIL = "auth-test@example.com";

async function seedUser(email = EMAIL) {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, ?, 'x', datetime('now'))",
  )
    .bind(email, "auth-test")
    .run();
}

beforeEach(async () => {
  // 各テストの前にauthMiddlewareが参照するテーブルをクリアしておく
  await env.DB.exec("DELETE FROM sessions");
  await env.DB.exec("DELETE FROM api_tokens");
  await env.DB.exec("DELETE FROM email_verification_tokens");
  await env.DB.exec("DELETE FROM password_reset_tokens");
  await env.DB.exec("DELETE FROM auth_attempts");
  await env.DB.exec("DELETE FROM users");
});

function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** 確認メールのリンクに載る生トークンを、テストから既知の値で発行する(DBにはハッシュのみ保存される) */
async function issueVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  await env.DB.prepare(
    "INSERT INTO email_verification_tokens (token_hash, user_email, expires_at) VALUES (?, ?, datetime('now', '+1 day'))",
  )
    .bind(await hashToken(token), email)
    .run();
  return token;
}

async function issueApiToken(email: string): Promise<string> {
  const token = generateToken();
  await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
    .bind(await hashToken(token), email)
    .run();
  return token;
}

describe("個人アクセストークンの保護", () => {
  it("パスワード再設定で、既存の個人アクセストークンも失効する", async () => {
    await seedUser();
    const apiToken = await issueApiToken(EMAIL);
    const resetToken = generateToken();
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_email, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))",
    )
      .bind(await hashToken(resetToken), EMAIL)
      .run();

    const resetRes = await postJson("/api/auth/reset-password", { token: resetToken, password: "new-password" });
    expect(resetRes.status).toBe(200);

    const meRes = await SELF.fetch("https://example.com/api/me", { headers: { Authorization: `Bearer ${apiToken}` } });
    expect(meRes.status).toBe(401);
  });

  it("個人アクセストークンでは新しいトークンを発行できない", async () => {
    await seedUser();
    const apiToken = await issueApiToken(EMAIL);

    const res = await postJson("/api/me/tokens", { label: "x" }, { Authorization: `Bearer ${apiToken}` });
    expect(res.status).toBe(403);
  });

  it("ログイン中のセッションからはトークンを発行できる", async () => {
    await seedUser();
    const session = await createSession(env.DB, EMAIL);

    const res = await postJson("/api/me/tokens", { label: "x" }, { Cookie: `session=${session}` });
    expect(res.status).toBe(200);
  });
});

describe("ログイン試行の制限", () => {
  const ATTACKER_IP = { "CF-Connecting-IP": "203.0.113.10" };
  const VICTIM_IP = { "CF-Connecting-IP": "198.51.100.20" };

  it("第三者が別のIPから失敗を繰り返しても、本人は自分のIPからログインできる", async () => {
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, 'victim', ?, datetime('now'))",
    )
      .bind(EMAIL, await hashPassword("correct-password"))
      .run();

    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await postJson("/api/auth/login", { email: EMAIL, password: "wrong-password" }, ATTACKER_IP)).status;
    }
    expect(last).toBe(429);

    const res = await postJson("/api/auth/login", { email: EMAIL, password: "correct-password" }, VICTIM_IP);
    expect(res.status).toBe(200);
  });

  it("同じIPから多数のアカウントを試すと、IP単位で制限される", async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      last = (await postJson("/api/auth/login", { email: `user${i}@example.com`, password: "wrong-password" }, ATTACKER_IP))
        .status;
    }
    expect(last).toBe(429);
  });
});

describe("会員登録とメール確認", () => {
  it("登録時はメールアドレスだけで受け付ける", async () => {
    const res = await postJson("/api/auth/register", { email: EMAIL });
    expect(res.status).toBe(200);
  });

  it("未確認のアドレスに第三者がパスワード付きで再登録しても、確認時に設定したパスワードだけが有効になる", async () => {
    await postJson("/api/auth/register", { email: EMAIL });
    // 第三者(攻撃者)による再登録。旧仕様ではここでパスワードが上書きされていた
    await postJson("/api/auth/register", { email: EMAIL, password: "attacker-pass" });

    const pending = await env.DB.prepare("SELECT password_hash, display_name FROM users WHERE email = ?")
      .bind(EMAIL)
      .first<{ password_hash: string | null; display_name: string }>();
    expect(pending?.password_hash).toBeNull();
    expect(pending?.display_name).not.toBe("auth-test");

    const token = await issueVerificationToken(EMAIL);
    const verifyRes = await postJson("/api/auth/verify-email", { token, password: "victim-pass", displayName: "本人" });
    expect(verifyRes.status).toBe(200);

    expect((await postJson("/api/auth/login", { email: EMAIL, password: "attacker-pass" })).status).toBe(401);
    expect((await postJson("/api/auth/login", { email: EMAIL, password: "victim-pass" })).status).toBe(200);

    const user = await env.DB.prepare("SELECT display_name FROM users WHERE email = ?")
      .bind(EMAIL)
      .first<{ display_name: string }>();
    expect(user?.display_name).toBe("本人");
  });

  it("確認時にパスワードが無ければ確認済みにしない", async () => {
    await postJson("/api/auth/register", { email: EMAIL });
    const token = await issueVerificationToken(EMAIL);

    const res = await postJson("/api/auth/verify-email", { token, displayName: "本人" });
    expect(res.status).toBe(400);

    const user = await env.DB.prepare("SELECT email_verified_at FROM users WHERE email = ?")
      .bind(EMAIL)
      .first<{ email_verified_at: string | null }>();
    expect(user?.email_verified_at).toBeNull();
  });
});

describe("authMiddleware", () => {
  it("認証情報が無い場合は401を返す", async () => {
    const res = await SELF.fetch("https://example.com/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("有効なセッションCookieがあれば認証される", async () => {
    await seedUser();
    const token = await createSession(env.DB, EMAIL);

    const res = await SELF.fetch("https://example.com/api/me", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string } }>();
    expect(body.user.email).toBe(EMAIL);
  });

  it("期限切れのセッションCookieは拒否される", async () => {
    await seedUser();
    const token = generateToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_email, expires_at) VALUES (?, ?, datetime('now', '-1 day'))",
    )
      .bind(tokenHash, EMAIL)
      .run();

    const res = await SELF.fetch("https://example.com/api/me", {
      headers: { Cookie: `session=${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("有効な個人アクセストークン(Authorization: Bearer)で認証される", async () => {
    await seedUser();
    const token = generateToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
      .bind(tokenHash, EMAIL)
      .run();

    const res = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string } }>();
    expect(body.user.email).toBe(EMAIL);
  });

  it("期限切れの個人アクセストークンは拒否される", async () => {
    await seedUser();
    const token = generateToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare(
      "INSERT INTO api_tokens (token_hash, user_email, label, expires_at) VALUES (?, ?, 'test', datetime('now', '-1 day'))",
    )
      .bind(tokenHash, EMAIL)
      .run();

    const res = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("失効(削除)済みの個人アクセストークンは拒否される", async () => {
    await seedUser();
    const token = generateToken();
    // DBには一切登録しない = 失効済み/存在しないトークンを模す
    const res = await SELF.fetch("https://example.com/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("?token= クエリパラメータは /api/mcp でのみ認証手段として使える", async () => {
    await seedUser();
    const token = generateToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
      .bind(tokenHash, EMAIL)
      .run();

    const mcpRes = await SELF.fetch(`https://example.com/api/mcp?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(mcpRes.status).toBe(200);

    // 他のエンドポイントでは ?token= だけでは認証されない
    const meRes = await SELF.fetch(`https://example.com/api/me?token=${token}`);
    expect(meRes.status).toBe(401);
  });
});
