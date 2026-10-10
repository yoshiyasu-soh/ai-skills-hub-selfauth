import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Turnstile を有効にした本番相当の設定(テスト用の wrangler.test.jsonc では未設定=無効)
const turnstileEnv = {
  ...env,
  TURNSTILE_SITE_KEY: "test-site-key",
  TURNSTILE_SECRET: "test-secret",
  TURNSTILE_HOSTNAMES: "skills.example.com",
};

function siteverifyReturns(result: Record<string, unknown>) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(result)));
}

function post(path: string, body: unknown, e: typeof env = turnstileEnv) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.5" },
      body: JSON.stringify(body),
    },
    e,
  );
}

async function userExists(email: string): Promise<boolean> {
  return Boolean(await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first());
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM email_verification_tokens");
  await env.DB.exec("DELETE FROM password_reset_tokens");
  await env.DB.exec("DELETE FROM auth_attempts");
  await env.DB.exec("DELETE FROM users");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Turnstile(ボット対策)", () => {
  it("公開設定APIでサイトキーを配信する", async () => {
    const res = await app.request("/api/auth/config", {}, turnstileEnv);
    expect(await res.json()).toEqual({ turnstileSiteKey: "test-site-key" });
  });

  it("トークンが無い会員登録は拒否し、アカウントも作らない", async () => {
    const res = await post("/api/auth/register", { email: "bot@example.com" });
    expect(res.status).toBe(403);
    expect(await userExists("bot@example.com")).toBe(false);
  });

  it("検証に成功し、action とホスト名が一致すれば登録できる", async () => {
    const fetchSpy = siteverifyReturns({ success: true, action: "signup", hostname: "skills.example.com" });

    const res = await post("/api/auth/register", { email: "human@example.com", turnstileToken: "token-1" });
    expect(res.status).toBe(200);
    expect(await userExists("human@example.com")).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    const sent = new URLSearchParams(String((init as RequestInit).body));
    expect(sent.get("secret")).toBe("test-secret");
    expect(sent.get("response")).toBe("token-1");
    expect(sent.get("remoteip")).toBe("203.0.113.5");
  });

  it("別の画面(action)向けに発行されたトークンは拒否する", async () => {
    siteverifyReturns({ success: true, action: "password_reset", hostname: "skills.example.com" });
    const res = await post("/api/auth/register", { email: "human@example.com", turnstileToken: "token-1" });
    expect(res.status).toBe(403);
  });

  it("許可していないホスト名で発行されたトークンは拒否する", async () => {
    siteverifyReturns({ success: true, action: "signup", hostname: "evil.example.net" });
    const res = await post("/api/auth/register", { email: "human@example.com", turnstileToken: "token-1" });
    expect(res.status).toBe(403);
  });

  it("検証APIに到達できない場合は拒否する(フェイルクローズ)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const res = await post("/api/auth/register", { email: "human@example.com", turnstileToken: "token-1" });
    expect(res.status).toBe(403);
  });

  it("シークレットが未設定なら、サイトキーがあっても拒否する(設定漏れで素通りさせない)", async () => {
    const res = await post(
      "/api/auth/register",
      { email: "human@example.com", turnstileToken: "token-1" },
      { ...turnstileEnv, TURNSTILE_SECRET: undefined },
    );
    expect(res.status).toBe(403);
  });

  it("パスワード再設定の申請も、トークンが無ければ拒否する", async () => {
    const res = await post("/api/auth/request-password-reset", { email: "human@example.com" });
    expect(res.status).toBe(403);
  });

  it("パスワード再設定の申請は、検証に成功すれば受け付ける", async () => {
    siteverifyReturns({ success: true, action: "password_reset", hostname: "skills.example.com" });
    const res = await post("/api/auth/request-password-reset", { email: "human@example.com", turnstileToken: "t" });
    expect(res.status).toBe(200);
  });
});

describe("パスワード再設定メールの送信制限", () => {
  it("同じIPからの申請は、アドレスを変えても一定数で打ち切る", async () => {
    for (let i = 0; i < 12; i++) {
      await env.DB.prepare(
        "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, 'u', 'x', datetime('now'))",
      )
        .bind(`user${i}@example.com`)
        .run();
    }
    for (let i = 0; i < 12; i++) {
      await post("/api/auth/request-password-reset", { email: `user${i}@example.com` }, env);
    }

    const row = await env.DB.prepare("SELECT COUNT(*) as cnt FROM password_reset_tokens").first<{ cnt: number }>();
    expect(row?.cnt).toBe(10);
  });
});
