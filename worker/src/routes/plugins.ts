import type { Context } from "hono";
import { Hono } from "hono";
import { getOrBuildPluginPackage, pluginIdentifier } from "../lib/pluginArchive";
import type { AuthUser, Env, ItemRow } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { user: AuthUser } }>;

const plugins = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

function resolveBaseUrl(c: AppContext): string {
  return c.env.APP_BASE_URL ?? new URL(c.req.url).origin;
}

type SkillItemRow = ItemRow & { author_display_name: string };

// ---- Claude Code の `claude plugin marketplace add` が読み込むマーケットプレイス定義 ----
// type=skill / mod のアイテムを都度DBから列挙して動的に生成する(静的ファイルは持たない)。
// 認証は index.ts の authMiddleware(Authorization: Bearer <個人アクセストークン>)に委ねる。
plugins.get("/marketplace.json", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, u.display_name as author_display_name
     FROM items i JOIN users u ON u.email = i.author_email
     WHERE i.type IN ('skill', 'mod')
     ORDER BY i.created_at ASC`,
  ).all<SkillItemRow>();

  const baseUrl = resolveBaseUrl(c);
  const entries: Record<string, unknown>[] = [];

  for (const item of results ?? []) {
    // 1件の変換失敗(R2の一時的な障害等)で一覧全体が失敗しないよう、そのアイテムだけを除外する
    const pkg = await getOrBuildPluginPackage(c.env, item, item.author_display_name).catch((err: unknown) => {
      console.error(`plugin package build failed: item=${item.id}`, err);
      return null;
    });
    // SKILL.mdが見つからない等、プラグイン形式に変換できないものは一覧から除外する
    if (!pkg) continue;

    entries.push({
      name: pluginIdentifier(item),
      description: item.summary || item.title,
      displayName: item.title,
      version: item.version,
      source: {
        source: "archive",
        url: `${baseUrl}/api/plugins/${item.id}/archive.zip`,
        sha256: pkg.sha256Hex,
      },
    });
  }

  return c.json({
    name: "ai-skills-hub",
    owner: { name: "AI Skills Hub" },
    description: "AI Skills Hub に登録されたスキル・Modのマーケットプレイス",
    plugins: entries,
  });
});

// ---- 個別スキルのプラグインzip配信 ----
plugins.get("/:id/archive.zip", async (c) => {
  const id = c.req.param("id");
  const item = await c.env.DB.prepare(
    `SELECT i.*, u.display_name as author_display_name
     FROM items i JOIN users u ON u.email = i.author_email
     WHERE i.id = ?`,
  )
    .bind(id)
    .first<SkillItemRow>();

  if (!item || (item.type !== "skill" && item.type !== "mod")) return c.json({ error: "not_found" }, 404);

  const pkg = await getOrBuildPluginPackage(c.env, item, item.author_display_name);
  if (!pkg) return c.json({ error: "not_pluginizable" }, 400);

  return new Response(pkg.zipBytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${item.id}.zip"`,
    },
  });
});

export default plugins;
