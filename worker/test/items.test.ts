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
  await env.DB.exec("DELETE FROM item_comments");
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

  it("正しいexternalは201で作成できる(GitHubスター数も保存される)", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({
        type: "external",
        title: "テストOSS",
        sourceUrl: "https://github.com/example/repo",
        sourceAuthor: "example",
        license: "MIT",
        stars: 1234,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json<{
      item: { sourceUrl: string; sourceAuthor: string; license: string; stars: number | null };
    }>();
    expect(data.item.sourceUrl).toBe("https://github.com/example/repo");
    expect(data.item.sourceAuthor).toBe("example");
    expect(data.item.license).toBe("MIT");
    expect(data.item.stars).toBe(1234);
  });

  it("type=promptにstarsを送っても保存されない(external専用)", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "プロンプト", body: "本文", stars: 999 }),
    });
    expect(res.status).toBe(201);
    const data = await res.json<{ item: { stars: number | null } }>();
    expect(data.item.stars).toBeNull();
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

describe("コメントスレッド", () => {
  async function createPrompt(): Promise<string> {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "所有者のプロンプト", body: "本文" }),
    });
    const data = await res.json<{ item: { id: string } }>();
    return data.item.id;
  }

  it("本文未指定は400", async () => {
    const id = await createPrompt();
    const res = await SELF.fetch(`https://example.com/api/items/${id}/comments`, {
      method: "POST",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ body: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("存在しないアイテムへの投稿は404", async () => {
    const res = await SELF.fetch("https://example.com/api/items/does-not-exist/comments", {
      method: "POST",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ body: "こんにちは" }),
    });
    expect(res.status).toBe(404);
  });

  it("投稿・一覧取得ができ、投稿者自身は削除できる(canDelete=true)", async () => {
    const id = await createPrompt();
    const createRes = await SELF.fetch(`https://example.com/api/items/${id}/comments`, {
      method: "POST",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ body: "とても参考になりました" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json<{ comment: { id: number; body: string; authorEmail: string; canDelete: boolean } }>();
    expect(created.comment.body).toBe("とても参考になりました");
    expect(created.comment.authorEmail).toBe(OTHER);
    expect(created.comment.canDelete).toBe(true);

    const listRes = await SELF.fetch(`https://example.com/api/items/${id}/comments`, {
      headers: await authHeaders(OTHER),
    });
    expect(listRes.status).toBe(200);
    const list = await listRes.json<{ comments: { id: number }[] }>();
    expect(list.comments).toHaveLength(1);

    const deleteRes = await SELF.fetch(`https://example.com/api/items/${id}/comments/${created.comment.id}`, {
      method: "DELETE",
      headers: await authHeaders(OTHER),
    });
    expect(deleteRes.status).toBe(200);
  });

  it("第三者はコメントを削除できない(403)が、アイテムの投稿者はモデレーションとして削除できる", async () => {
    const id = await createPrompt();
    const createRes = await SELF.fetch(`https://example.com/api/items/${id}/comments`, {
      method: "POST",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ body: "コメント" }),
    });
    const created = await createRes.json<{ comment: { id: number } }>();

    // 第三者(コメント投稿者でもアイテム投稿者でもない)は削除不可
    const thirdParty = "third@example.com";
    await seedUser(thirdParty);
    const forbiddenRes = await SELF.fetch(`https://example.com/api/items/${id}/comments/${created.comment.id}`, {
      method: "DELETE",
      headers: await authHeaders(thirdParty),
    });
    expect(forbiddenRes.status).toBe(403);

    // アイテムの投稿者(OWNER)はコメント投稿者でなくてもモデレーションとして削除できる
    const ownerDeleteRes = await SELF.fetch(`https://example.com/api/items/${id}/comments/${created.comment.id}`, {
      method: "DELETE",
      headers: await authHeaders(OWNER),
    });
    expect(ownerDeleteRes.status).toBe(200);
  });

  it("アイテムを削除するとコメントも連動して削除される", async () => {
    const id = await createPrompt();
    await SELF.fetch(`https://example.com/api/items/${id}/comments`, {
      method: "POST",
      headers: await authHeaders(OTHER),
      body: JSON.stringify({ body: "コメント" }),
    });

    await SELF.fetch(`https://example.com/api/items/${id}`, {
      method: "DELETE",
      headers: await authHeaders(OWNER),
    });

    const row = await env.DB.prepare("SELECT COUNT(*) as c FROM item_comments WHERE item_id = ?")
      .bind(id)
      .first<{ c: number }>();
    expect(row?.c).toBe(0);
  });
});
