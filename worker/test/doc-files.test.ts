import { strToU8, zipSync } from "fflate";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../src/lib/auth/tokens";

const OWNER = "owner@example.com";
const OTHER = "other@example.com";

async function seedUser(email: string) {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, email_verified_at) VALUES (?, ?, 'x', datetime('now'))",
  )
    .bind(email, email.split("@")[0])
    .run();
}

async function apiTokenHeaders(email: string): Promise<Record<string, string>> {
  const token = generateToken();
  await env.DB.prepare("INSERT INTO api_tokens (token_hash, user_email, label) VALUES (?, ?, 'test')")
    .bind(await hashToken(token), email)
    .run();
  return { Authorization: `Bearer ${token}` };
}

async function createItem(headers: Record<string, string>, type: "skill" | "agent", file: File): Promise<string> {
  const form = new FormData();
  form.set("type", type);
  form.set("title", "ビューア検証");
  form.set("file", file);
  const res = await SELF.fetch("https://example.com/api/items", { method: "POST", headers, body: form });
  return (await res.json<{ item: { id: string } }>()).item.id;
}

type Files = { files: { path: string; kind: string; source: string }[] };

beforeEach(async () => {
  for (const t of ["item_tags", "favorites", "item_watches", "usage_events", "item_comments", "item_versions", "items", "api_tokens", "users"]) {
    await env.DB.exec(`DELETE FROM ${t}`);
  }
  await seedUser(OWNER);
  await seedUser(OTHER);
});

describe("GET /api/items/:id/files", () => {
  it("SKILL.md単体はmarkdown 1ファイルで返る", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const id = await createItem(headers, "skill", new File(["# こんにちは"], "SKILL.md", { type: "text/markdown" }));
    const res = await SELF.fetch(`https://example.com/api/items/${id}/files`, { headers });
    expect(res.status).toBe(200);
    expect(await res.json<Files>()).toEqual({ files: [{ path: "SKILL.md", kind: "markdown", source: "# こんにちは" }] });
  });

  it("ZIPは展開され、SKILL.mdが先頭・バイナリとMACOSXは除外される", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const zip = zipSync({
      "pkg/LICENSE.txt": strToU8("MIT"),
      "pkg/SKILL.md": strToU8("---\nname: x\n---\n# X"),
      "pkg/logo.png": new Uint8Array([137, 80, 0, 71]),
      "__MACOSX/pkg/._SKILL.md": strToU8("junk"),
    });
    const id = await createItem(headers, "skill", new File([zip], "skill.zip", { type: "application/zip" }));
    const res = await SELF.fetch(`https://example.com/api/items/${id}/files`, { headers });
    const { files } = await res.json<Files>();
    expect(files.map((f) => [f.path, f.kind])).toEqual([
      ["pkg/SKILL.md", "markdown"],
      ["pkg/LICENSE.txt", "text"],
    ]);
  });

  it("閲覧ではDL数が加算されない", async () => {
    const owner = await apiTokenHeaders(OWNER);
    const id = await createItem(owner, "skill", new File(["# a"], "SKILL.md", { type: "text/markdown" }));
    const other = await apiTokenHeaders(OTHER);
    await SELF.fetch(`https://example.com/api/items/${id}/files`, { headers: other });
    const row = await env.DB.prepare("SELECT usage_count FROM items WHERE id = ?").bind(id).first<{ usage_count: number }>();
    expect(row?.usage_count).toBe(0);
  });

  it("agent単体.mdも返り、promptは空配列、未認証は401、存在しないIDは404", async () => {
    const headers = await apiTokenHeaders(OWNER);
    const agentId = await createItem(headers, "agent", new File(["# a"], "agent.md", { type: "text/markdown" }));
    const agent = await SELF.fetch(`https://example.com/api/items/${agentId}/files`, { headers });
    expect((await agent.json<Files>()).files).toHaveLength(1);

    const created = await SELF.fetch("https://example.com/api/items", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prompt", title: "p", body: "b" }),
    });
    const promptId = (await created.json<{ item: { id: string } }>()).item.id;
    const prompt = await SELF.fetch(`https://example.com/api/items/${promptId}/files`, { headers });
    expect(await prompt.json()).toEqual({ files: [] });

    expect((await SELF.fetch(`https://example.com/api/items/${agentId}/files`)).status).toBe(401);
    expect((await SELF.fetch("https://example.com/api/items/nope/files", { headers })).status).toBe(404);
  });
});
