import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
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
  await env.DB.exec("DELETE FROM users");
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
