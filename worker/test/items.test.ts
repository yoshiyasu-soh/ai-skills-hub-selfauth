import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../src/lib/auth/session";

const OWNER = "owner@example.com";
const OTHER = "other@example.com";

async function seedUser(email: string) {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, ?, 'x', datetime('now'))",
  )
    .bind(email, email.split("@")[0])
    .run();
}

async function authHeaders(email: string): Promise<Record<string, string>> {
  const token = await createSession(env.DB, email);
  return { Cookie: `session=${token}`, "Content-Type": "application/json" };
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM item_tags");
  await env.DB.exec("DELETE FROM favorites");
  await env.DB.exec("DELETE FROM item_watches");
  await env.DB.exec("DELETE FROM usage_events");
  await env.DB.exec("DELETE FROM items");
  await env.DB.exec("DELETE FROM sessions");
  await env.DB.exec("DELETE FROM users");
  await seedUser(OWNER);
  await seedUser(OTHER);
});

describe("POST /api/items バリデーション", () => {
  it("タイトル未指定は400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", body: "本文" }),
    });
    expect(res.status).toBe(400);
  });

  it("不正なtypeは400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "unknown", title: "テスト" }),
    });
    expect(res.status).toBe(400);
  });

  it("type=promptでbody未指定は400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テスト" }),
    });
    expect(res.status).toBe(400);
  });

  it("type=externalでsourceUrl未指定は400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "external", title: "テスト" }),
    });
    expect(res.status).toBe(400);
  });

  it("type=externalでsourceUrlが不正なURLだと400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "external", title: "テスト", sourceUrl: "not-a-url" }),
    });
    expect(res.status).toBe(400);
  });

  it("type=skillでfile未指定は400", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "skill", title: "テスト" }),
    });
    expect(res.status).toBe(400);
  });

  it("正しいpromptは201で作成できる", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テストプロンプト", body: "本文" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json<{ item: { id: string; type: string; title: string } }>();
    expect(data.item.type).toBe("prompt");
    expect(data.item.title).toBe("テストプロンプト");
  });

  it("正しいexternalは201で作成できる", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({
        type: "external",
        title: "テストOSS",
        sourceUrl: "https://github.com/example/repo",
        sourceAuthor: "example",
        license: "MIT",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json<{ item: { sourceUrl: string; sourceAuthor: string; license: string } }>();
    expect(data.item.sourceUrl).toBe("https://github.com/example/repo");
    expect(data.item.sourceAuthor).toBe("example");
    expect(data.item.license).toBe("MIT");
  });
});

describe("PUT/DELETE /api/items/:id 権限", () => {
  async function createPrompt(): Promise<string> {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "所有者のプロンプト", body: "本文" }),
    });
    const data = await res.json<{ item: { id: string } }>();
    return data.item.id;
  }

  it("投稿者以外はPUTできない(403)", async () => {
    const id = await createPrompt();
    const res = await SELF.fetch(`https://example.com/api/items/${id}`, {
      method: "PUT",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ title: "乗っ取り" }),
    });
    expect(res.status).toBe(403);
  });

  it("投稿者以外はDELETEできない(403)", async () => {
    const id = await createPrompt();
    const res = await SELF.fetch(`https://example.com/api/items/${id}`, {
      method: "DELETE",
      headers: await authHeaders(OTHER),
    });
    expect(res.status).toBe(403);
  });

  it("投稿者本人はPUT/DELETEできる", async () => {
    const id = await createPrompt();
    const putRes = await SELF.fetch(`https://example.com/api/items/${id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ title: "更新後タイトル" }),
    });
    expect(putRes.status).toBe(200);

    const deleteRes = await SELF.fetch(`https://example.com/api/items/${id}`, {
      method: "DELETE",
      headers: await authHeaders(OWNER),
    });
    expect(deleteRes.status).toBe(200);
  });
});
