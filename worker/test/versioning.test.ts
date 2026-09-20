import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../src/lib/auth/session";
import { bumpPatchVersion } from "../src/lib/items";

const OWNER = "owner@example.com";

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
  await env.DB.exec("DELETE FROM item_versions");
  await env.DB.exec("DELETE FROM items");
  await env.DB.exec("DELETE FROM sessions");
  await env.DB.exec("DELETE FROM users");
  await seedUser(OWNER);
});

describe("bumpPatchVersion", () => {
  it("パッチ番号を+1する", () => {
    expect(bumpPatchVersion("1.0.0")).toBe("1.0.1");
    expect(bumpPatchVersion("2.3.9")).toBe("2.3.10");
  });

  it("semver形式でない場合は1.0.1にフォールバックする", () => {
    expect(bumpPatchVersion("v1")).toBe("1.0.1");
    expect(bumpPatchVersion("2024-01-01")).toBe("1.0.1");
  });
});

describe("バージョンの自動管理(手動入力は無視される)", () => {
  it("新規作成時は送信したversionに関わらず常に1.0.0になる", async () => {
    const res = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テスト", body: "本文", version: "9.9.9" }),
    });
    const data = await res.json<{ item: { version: string } }>();
    expect(data.item.version).toBe("1.0.0");
  });

  it("プロンプトはbodyを変更した時だけバージョンが上がる", async () => {
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テスト", body: "本文v1" }),
    });
    const { item } = await createRes.json<{ item: { id: string; version: string } }>();
    expect(item.version).toBe("1.0.0");

    // タグ・タイトルだけの変更(bodyは同一)ではバージョンは変わらない
    const noopRes = await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ title: "テスト(改題)", body: "本文v1" }),
    });
    const noop = await noopRes.json<{ item: { version: string } }>();
    expect(noop.item.version).toBe("1.0.0");

    // bodyの変更で自動的にパッチバージョンが上がる。手動指定したversionは無視される
    const changedRes = await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ body: "本文v2", version: "9.9.9" }),
    });
    const changed = await changedRes.json<{ item: { version: string } }>();
    expect(changed.item.version).toBe("1.0.1");
  });

  it("スキルはファイルを再アップロードした時だけバージョンが上がる", async () => {
    const form1 = new FormData();
    form1.set("type", "skill");
    form1.set("title", "テストスキル");
    form1.set("file", new File(["v1の内容"], "SKILL.md", { type: "text/markdown" }));
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: { Cookie: (await authHeaders(OWNER)).Cookie },
      body: form1,
    });
    const { item } = await createRes.json<{ item: { id: string; version: string } }>();
    expect(item.version).toBe("1.0.0");

    // 説明文だけの変更(ファイル未送信)ではバージョンは変わらない
    const noopRes = await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ description: "説明を追記" }),
    });
    const noop = await noopRes.json<{ item: { version: string } }>();
    expect(noop.item.version).toBe("1.0.0");

    // ファイルを差し替えるとバージョンが上がる
    const form2 = new FormData();
    form2.set("file", new File(["v2の内容"], "SKILL.md", { type: "text/markdown" }));
    const changedRes = await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: { Cookie: (await authHeaders(OWNER)).Cookie },
      body: form2,
    });
    const changed = await changedRes.json<{ item: { version: string } }>();
    expect(changed.item.version).toBe("1.0.1");
  });

  it("外部紹介(external)はsourceUrlを変更してもバージョンは変わらない", async () => {
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "external", title: "テストOSS", sourceUrl: "https://github.com/example/a" }),
    });
    const { item } = await createRes.json<{ item: { id: string; version: string } }>();
    expect(item.version).toBe("1.0.0");

    const changedRes = await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ sourceUrl: "https://github.com/example/b" }),
    });
    const changed = await changedRes.json<{ item: { version: string } }>();
    expect(changed.item.version).toBe("1.0.0");
  });
});

describe("過去バージョンの参照", () => {
  it("プロンプトの本文を2回変更すると、置き換え前の内容が古い順で履歴に残る", async () => {
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テスト", body: "本文v1" }),
    });
    const { item } = await createRes.json<{ item: { id: string } }>();

    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ body: "本文v2" }),
    });
    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ body: "本文v3" }),
    });

    const listRes = await SELF.fetch(`https://example.com/api/items/${item.id}/versions`, {
      headers: await authHeaders(OWNER),
    });
    expect(listRes.status).toBe(200);
    const { versions } = await listRes.json<{ versions: { version: string; body: string }[] }>();
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ version: "1.0.0", body: "本文v1" });
    expect(versions[1]).toMatchObject({ version: "1.0.1", body: "本文v2" });

    // タグ・タイトルだけの変更では履歴は増えない
    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ title: "改題", body: "本文v3" }),
    });
    const listRes2 = await SELF.fetch(`https://example.com/api/items/${item.id}/versions`, {
      headers: await authHeaders(OWNER),
    });
    const { versions: versions2 } = await listRes2.json<{ versions: unknown[] }>();
    expect(versions2).toHaveLength(2);
  });

  it("スキルのファイルを差し替えても、過去バージョンのファイルは残り、ダウンロードできる", async () => {
    const form1 = new FormData();
    form1.set("type", "skill");
    form1.set("title", "テストスキル");
    form1.set("file", new File(["v1の内容"], "SKILL.md", { type: "text/markdown" }));
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: { Cookie: (await authHeaders(OWNER)).Cookie },
      body: form1,
    });
    const { item } = await createRes.json<{ item: { id: string } }>();

    const form2 = new FormData();
    form2.set("file", new File(["v2の内容"], "SKILL.md", { type: "text/markdown" }));
    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: { Cookie: (await authHeaders(OWNER)).Cookie },
      body: form2,
    });

    const listRes = await SELF.fetch(`https://example.com/api/items/${item.id}/versions`, {
      headers: await authHeaders(OWNER),
    });
    const { versions } = await listRes.json<{ versions: { id: number; version: string; fileName: string }[] }>();
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe("1.0.0");
    expect(versions[0].fileName).toBe("SKILL.md");

    const downloadRes = await SELF.fetch(
      `https://example.com/api/items/${item.id}/versions/${versions[0].id}/download`,
      { headers: await authHeaders(OWNER) },
    );
    expect(downloadRes.status).toBe(200);
    const content = await downloadRes.text();
    expect(content).toBe("v1の内容");

    // 現在のダウンロードはv2の内容になっている(過去バージョンの取得が現在の内容を壊していない)
    const currentRes = await SELF.fetch(`https://example.com/api/items/${item.id}/download`, {
      headers: await authHeaders(OWNER),
    });
    expect(await currentRes.text()).toBe("v2の内容");
  });

  it("外部紹介(external)は常にバージョン履歴が空になる", async () => {
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "external", title: "テストOSS", sourceUrl: "https://github.com/example/a" }),
    });
    const { item } = await createRes.json<{ item: { id: string } }>();

    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ sourceUrl: "https://github.com/example/b" }),
    });

    const listRes = await SELF.fetch(`https://example.com/api/items/${item.id}/versions`, {
      headers: await authHeaders(OWNER),
    });
    const { versions } = await listRes.json<{ versions: unknown[] }>();
    expect(versions).toHaveLength(0);
  });

  it("アイテムを削除すると過去バージョンの履歴も連動して削除される", async () => {
    const createRes = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ type: "prompt", title: "テスト", body: "本文v1" }),
    });
    const { item } = await createRes.json<{ item: { id: string } }>();
    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers: await authHeaders(OWNER),
      body: JSON.stringify({ body: "本文v2" }),
    });

    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "DELETE",
      headers: await authHeaders(OWNER),
    });

    const row = await env.DB.prepare("SELECT COUNT(*) as c FROM item_versions WHERE item_id = ?")
      .bind(item.id)
      .first<{ c: number }>();
    expect(row?.c).toBe(0);
  });
});
