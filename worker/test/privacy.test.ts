import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../src/lib/auth/session";
import { generateToken, hashToken } from "../src/lib/auth/tokens";

// メールアドレスは他の利用者に公開しない(プロフィールURL・投稿者表示には公開IDを使う)
const AUTHOR = "author-private@example.com";
const AUTHOR_ID = "a1b2c3d4e5f60718";
const VIEWER = "viewer-private@example.com";
const VIEWER_ID = "0f1e2d3c4b5a6978";

async function seedUser(email: string, publicId: string, displayName: string) {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, email_verified_at, public_id) VALUES (?, ?, 'x', datetime('now'), ?)",
  )
    .bind(email, displayName, publicId)
    .run();
}

async function cookieOf(email: string): Promise<Record<string, string>> {
  return { Cookie: `session=${await createSession(env.DB, email)}` };
}

async function createPrompt(headers: Record<string, string>): Promise<string> {
  const res = await SELF.fetch("https://example.com/api/items", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "prompt", title: "公開テスト", body: "本文" }),
  });
  const { item } = await res.json<{ item: { id: string } }>();
  return item.id;
}

beforeEach(async () => {
  for (const t of ["item_tags", "favorites", "item_watches", "usage_events", "item_comments", "item_versions", "items"]) {
    await env.DB.exec(`DELETE FROM ${t}`);
  }
  for (const t of ["sessions", "api_tokens", "email_verification_tokens", "auth_attempts", "users"]) {
    await env.DB.exec(`DELETE FROM ${t}`);
  }
  await seedUser(AUTHOR, AUTHOR_ID, "投稿者");
  await seedUser(VIEWER, VIEWER_ID, "閲覧者");
});

describe("メールアドレスを他の利用者に公開しない", () => {
  it("アイテムの一覧・詳細には投稿者のメールアドレスを含めず、公開IDを返す", async () => {
    const itemId = await createPrompt(await cookieOf(AUTHOR));
    const viewer = await cookieOf(VIEWER);

    const listRes = await SELF.fetch("https://example.com/api/items", { headers: viewer });
    const listText = await listRes.text();
    expect(listText).not.toContain(AUTHOR);

    const detailRes = await SELF.fetch(`https://example.com/api/items/${itemId}`, { headers: viewer });
    const detailText = await detailRes.text();
    expect(detailText).not.toContain(AUTHOR);
    expect(JSON.parse(detailText).item.authorId).toBe(AUTHOR_ID);
  });

  it("コメントには投稿者のメールアドレスを含めない", async () => {
    const itemId = await createPrompt(await cookieOf(AUTHOR));
    const viewer = await cookieOf(VIEWER);
    await SELF.fetch(`https://example.com/api/items/${itemId}/comments`, {
      method: "POST",
      headers: { ...viewer, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "コメント" }),
    });

    const res = await SELF.fetch(`https://example.com/api/items/${itemId}/comments`, { headers: await cookieOf(AUTHOR) });
    const text = await res.text();
    expect(text).not.toContain(VIEWER);
    expect(JSON.parse(text).comments[0].authorId).toBe(VIEWER_ID);
  });

  it("プロフィールは公開IDで取得でき、メールアドレスを含めない", async () => {
    const viewer = await cookieOf(VIEWER);

    const res = await SELF.fetch(`https://example.com/api/users/${AUTHOR_ID}`, { headers: viewer });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(AUTHOR);
    expect(JSON.parse(text).user.displayName).toBe("投稿者");

    const byEmail = await SELF.fetch(`https://example.com/api/users/${encodeURIComponent(AUTHOR)}`, { headers: viewer });
    expect(byEmail.status).toBe(404);
  });

  it("自分の情報(/api/me)にはメールアドレスと公開IDを含める", async () => {
    const res = await SELF.fetch("https://example.com/api/me", { headers: await cookieOf(VIEWER) });
    const { user } = await res.json<{ user: { email: string; id: string } }>();
    expect(user.email).toBe(VIEWER);
    expect(user.id).toBe(VIEWER_ID);
  });

  it("投稿者の絞り込みは公開ID(または me)で行う", async () => {
    await createPrompt(await cookieOf(AUTHOR));
    const viewer = await cookieOf(VIEWER);

    const byId = await SELF.fetch(`https://example.com/api/items?authorId=${AUTHOR_ID}`, { headers: viewer });
    expect((await byId.json<{ total: number }>()).total).toBe(1);

    const mine = await SELF.fetch("https://example.com/api/items?authorId=me", { headers: viewer });
    expect((await mine.json<{ total: number }>()).total).toBe(0);
  });

  it("MCPの get_item には投稿者のメールアドレスを含めない", async () => {
    const itemId = await createPrompt(await cookieOf(AUTHOR));
    const token = generateToken();
    await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
      .bind(await hashToken(token), VIEWER)
      .run();

    const res = await SELF.fetch("https://example.com/api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_item", arguments: { id: itemId } } }),
    });
    const text = await res.text();
    expect(text).toContain("公開テスト");
    expect(text).not.toContain(AUTHOR);
  });

  it("会員登録したユーザーには公開IDが割り当てられる", async () => {
    await SELF.fetch("https://example.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new-user@example.com" }),
    });
    const row = await env.DB.prepare("SELECT public_id FROM users WHERE email = ?")
      .bind("new-user@example.com")
      .first<{ public_id: string | null }>();
    expect(row?.public_id).toMatch(/^[0-9a-f]{16}$/);
  });
});
