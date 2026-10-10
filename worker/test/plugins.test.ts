import { unzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../src/lib/auth/tokens";
import { pluginIdentifier } from "../src/lib/pluginArchive";

const OWNER = "owner@example.com";
const SKILL_TITLE = "テストスキル";

async function seedUser(email: string) {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, ?, 'x', datetime('now'))",
  )
    .bind(email, email.split("@")[0])
    .run();
}

async function apiTokenHeaders(email: string): Promise<Record<string, string>> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
    .bind(tokenHash, email)
    .run();
  return { Authorization: `Bearer ${token}` };
}

async function createSkillItem(
  headers: Record<string, string>,
  file: File,
): Promise<{ id: string; version: string }> {
  const form = new FormData();
  form.set("type", "skill");
  form.set("title", SKILL_TITLE);
  form.set("file", file);
  const res = await SELF.fetch("https://example.com/api/items", {
    method: "POST",
    headers,
    body: form,
  });
  const { item } = await res.json<{ item: { id: string; version: string } }>();
  return item;
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM item_tags");
  await env.DB.exec("DELETE FROM favorites");
  await env.DB.exec("DELETE FROM item_watches");
  await env.DB.exec("DELETE FROM usage_events");
  await env.DB.exec("DELETE FROM item_comments");
  await env.DB.exec("DELETE FROM item_versions");
  await env.DB.exec("DELETE FROM items");
  await env.DB.exec("DELETE FROM api_tokens");
  await env.DB.exec("DELETE FROM users");
  await seedUser(OWNER);
});

describe("GET /api/plugins/marketplace.json", () => {
  it("認証なしは401", async () => {
    const res = await SELF.fetch("https://example.com/api/plugins/marketplace.json");
    expect(res.status).toBe(401);
  });

  it("個人アクセストークンで一覧が取得でき、SKILL.md単体スキルがpluginとして列挙される", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const item = await createSkillItem(headers, new File(["# こんにちは"], "SKILL.md", { type: "text/markdown" }));

    const res = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    expect(res.status).toBe(200);
    const body = await res.json<{ plugins: { name: string; source: { url: string; sha256: string } }[] }>();
    expect(body.plugins).toHaveLength(1);
    expect(body.plugins[0].name).toBe(pluginIdentifier({ id: item.id, title: SKILL_TITLE }));
    expect(body.plugins[0].source.url).toContain(`/api/plugins/${item.id}/archive.zip`);
    expect(body.plugins[0].source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("promptやexternalのアイテムは一覧に含まれない", async () => {
    const headers = await apiTokenHeaders(OWNER);
    await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prompt", title: "テストプロンプト", body: "本文" }),
    });

    const res = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    const body = await res.json<{ plugins: unknown[] }>();
    expect(body.plugins).toHaveLength(0);
  });

  it("ZIP形式でSKILL.mdが見つからないスキルは一覧から除外される", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const zipWithoutSkillMd = zipSync({ "readme.txt": strToU8("no skill here") });
    await createSkillItem(headers, new File([zipWithoutSkillMd], "skill.zip", { type: "application/zip" }));

    const res = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    const body = await res.json<{ plugins: unknown[] }>();
    expect(body.plugins).toHaveLength(0);
  });
});

describe("壊れたZIP・ZIP爆弾への耐性", () => {
  const BROKEN_ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xde, 0xad, 0xbe, 0xef]);

  it("ZIPとして壊れたファイルはスキルとして投稿できない", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const form = new FormData();
    form.set("type", "skill");
    form.set("title", SKILL_TITLE);
    form.set("file", new File([BROKEN_ZIP], "broken.zip", { type: "application/zip" }));

    const res = await SELF.fetch("https://example.com/api/items", { method: "POST", headers, body: form });
    expect(res.status).toBe(400);
  });

  it("展開後の合計サイズが上限を超えるZIPはスキルとして投稿できない", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const fifteenMb = new Uint8Array(15 * 1024 * 1024);
    const bomb = zipSync({ "SKILL.md": strToU8("# bomb"), "a.bin": fifteenMb, "b.bin": fifteenMb, "c.bin": fifteenMb });
    const form = new FormData();
    form.set("type", "skill");
    form.set("title", SKILL_TITLE);
    form.set("file", new File([bomb], "bomb.zip", { type: "application/zip" }));

    const res = await SELF.fetch("https://example.com/api/items", { method: "POST", headers, body: form });
    expect(res.status).toBe(400);
  });

  it("壊れたZIPへの差し替え(PUT)はできない", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const item = await createSkillItem(headers, new File(["# 正常"], "SKILL.md", { type: "text/markdown" }));
    const form = new FormData();
    form.set("file", new File([BROKEN_ZIP], "broken.zip", { type: "application/zip" }));

    const res = await SELF.fetch(`https://example.com/api/items/${item.id}`, { method: "PUT", headers, body: form });
    expect(res.status).toBe(400);
  });

  it("壊れたZIPのスキルが既に保存されていても、marketplace.jsonは他のアイテムを返す", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const good = await createSkillItem(headers, new File(["# 正常"], "SKILL.md", { type: "text/markdown" }));

    // 投稿時の検証が入る前に保存されたデータを想定し、APIを通さず直接保存する
    const brokenId = crypto.randomUUID();
    const brokenKey = `skills/${brokenId}/broken.zip`;
    await env.ASSETS_BUCKET.put(brokenKey, BROKEN_ZIP);
    await env.DB.prepare(
      `INSERT INTO items (id, type, slug, title, r2_key, file_name, file_size, author_email)
       VALUES (?, 'skill', ?, 'broken', ?, 'broken.zip', ?, ?)`,
    )
      .bind(brokenId, `broken-${brokenId.slice(0, 8)}`, brokenKey, BROKEN_ZIP.byteLength, OWNER)
      .run();

    const res = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    expect(res.status).toBe(200);
    const body = await res.json<{ plugins: { source: { url: string } }[] }>();
    expect(body.plugins).toHaveLength(1);
    expect(body.plugins[0].source.url).toContain(good.id);
  });
});

describe("GET /api/plugins/:id/archive.zip", () => {
  it("SKILL.md単体スキルは.claude-plugin/plugin.jsonとskills/<id>/SKILL.mdを含むzipになる", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const item = await createSkillItem(
      headers,
      new File(["# こんにちは\n動作確認用スキル"], "SKILL.md", { type: "text/markdown" }),
    );

    const res = await SELF.fetch(`https://example.com/api/plugins/${item.id}/archive.zip`, { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");

    const buf = new Uint8Array(await res.arrayBuffer());
    const entries = unzipSync(buf);

    const pluginJson = JSON.parse(strFromU8(entries[".claude-plugin/plugin.json"]));
    const identifier = pluginIdentifier({ id: item.id, title: SKILL_TITLE });
    expect(pluginJson.name).toBe(identifier);
    expect(pluginJson.version).toBe("1.0.0");

    const skillMd = strFromU8(entries[`skills/${identifier}/SKILL.md`]);
    expect(skillMd).toContain("動作確認用スキル");
  });

  it("ZIP形式スキル(サブフォルダにSKILL.mdあり)は正しく再パッケージされる", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const original = zipSync({
      "my-skill/SKILL.md": strToU8("# ネストされたスキル"),
      "my-skill/resource.txt": strToU8("補足資料"),
    });
    const item = await createSkillItem(headers, new File([original], "skill.zip", { type: "application/zip" }));
    const identifier = pluginIdentifier({ id: item.id, title: SKILL_TITLE });

    const res = await SELF.fetch(`https://example.com/api/plugins/${item.id}/archive.zip`, { headers });
    expect(res.status).toBe(200);

    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(strFromU8(entries[`skills/${identifier}/SKILL.md`])).toContain("ネストされたスキル");
    expect(strFromU8(entries[`skills/${identifier}/resource.txt`])).toBe("補足資料");
  });

  it("ZIP内のパストラバーサルを含むエントリは展開結果から除外される(Zip Slip対策)", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const original = zipSync({
      "my-skill/SKILL.md": strToU8("# 通常のスキル"),
      "my-skill/../../evil.txt": strToU8("escaped"),
      "../../../etc/cron.d/evil": strToU8("escaped2"),
    });
    const item = await createSkillItem(headers, new File([original], "skill.zip", { type: "application/zip" }));
    const identifier = pluginIdentifier({ id: item.id, title: SKILL_TITLE });

    const res = await SELF.fetch(`https://example.com/api/plugins/${item.id}/archive.zip`, { headers });
    expect(res.status).toBe(200);

    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    expect(strFromU8(entries[`skills/${identifier}/SKILL.md`])).toContain("通常のスキル");
    for (const path of Object.keys(entries)) {
      expect(path.startsWith(`skills/${identifier}/`) || path === ".claude-plugin/plugin.json").toBe(true);
      expect(path).not.toContain("..");
    }
  });

  it("ASCIIタイトルの場合、プラグイン名がUUIDではなく読める識別子になる", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const form = new FormData();
    form.set("type", "skill");
    form.set("title", "release-notes-generator");
    form.set("file", new File(["# リリースノート生成"], "SKILL.md", { type: "text/markdown" }));
    const createRes = await SELF.fetch("https://example.com/api/items", { method: "POST", headers, body: form });
    const { item } = await createRes.json<{ item: { id: string } }>();

    const res = await SELF.fetch(`https://example.com/api/plugins/${item.id}/archive.zip`, { headers });
    const entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const pluginJson = JSON.parse(strFromU8(entries[".claude-plugin/plugin.json"]));

    expect(pluginJson.name).toBe(`release-notes-generator-${item.id.slice(0, 8)}`);
    expect(pluginJson.name).not.toBe(item.id);
  });

  it("存在しないIDは404", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const res = await SELF.fetch("https://example.com/api/plugins/does-not-exist/archive.zip", { headers });
    expect(res.status).toBe(404);
  });

  it("ファイルを更新するとキャッシュが再構築され内容も追従する", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const item = await createSkillItem(headers, new File(["v1の内容"], "SKILL.md", { type: "text/markdown" }));
    const identifier = pluginIdentifier({ id: item.id, title: SKILL_TITLE });

    const marketRes1 = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    const market1 = await marketRes1.json<{ plugins: { source: { sha256: string } }[] }>();
    const hash1 = market1.plugins[0].source.sha256;

    const form = new FormData();
    form.set("file", new File(["v2の内容"], "SKILL.md", { type: "text/markdown" }));
    await SELF.fetch(`https://example.com/api/items/${item.id}`, {
      method: "PUT",
      headers,
      body: form,
    });

    const archiveRes = await SELF.fetch(`https://example.com/api/plugins/${item.id}/archive.zip`, { headers });
    const entries = unzipSync(new Uint8Array(await archiveRes.arrayBuffer()));
    expect(strFromU8(entries[`skills/${identifier}/SKILL.md`])).toBe("v2の内容");

    const marketRes2 = await SELF.fetch("https://example.com/api/plugins/marketplace.json", { headers });
    const market2 = await marketRes2.json<{ plugins: { source: { sha256: string } }[] }>();
    expect(market2.plugins[0].source.sha256).not.toBe(hash1);
  });
});
