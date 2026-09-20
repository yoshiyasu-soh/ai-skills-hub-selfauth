import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  applyTags,
  bumpPatchVersion,
  fetchItemRow,
  isValidHttpUrl,
  resolveOrCreateTagIds,
  searchItems,
  toItemDTOs,
} from "../lib/items";
import { slugify } from "../lib/slug";
import { markItemWatched } from "../lib/watches";
import type { Env, ItemRow } from "../types";

const SORT_VALUES = ["newest", "updated", "popular", "favorites", "name"] as const;

/**
 * MCP経由で公開するツール一式を登録する。参照系に加え、投稿・編集・お気に入り登録も対応する。
 * ただしスキルのZIP資産アップロードはMCPのテキストベースの入力では扱えないため、
 * type=skill の新規投稿・資産差し替えは SKILL.md 単体形式(テキスト)のみサポートする
 * (ZIP形式で投稿済みのスキルの資産差し替えはWebサイトから行う必要がある)。
 * 認証は呼び出し元のHonoルート(/api配下は authMiddleware で保護済み)にすべて委譲しており、
 * ここでは検証済みの viewerEmail を受け取って利用するだけで、MCP自体は追加のトークン検証を行わない。
 */
export function buildMcpServer(env: Env, viewerEmail: string, baseUrl: string): McpServer {
  const server = new McpServer({ name: "ai-skills-hub-selfauth", version: "1.0.0" });

  server.registerTool(
    "search_items",
    {
      title: "スキル・プロンプトを検索",
      description:
        "AI Skills Hub に投稿されているスキル(SKILL.md/ZIP)・プロンプト・外部OSS紹介をキーワード/種別/タグで検索する。",
      inputSchema: z.object({
        query: z.string().optional().describe("タイトル・概要・詳細説明を対象とした部分一致検索キーワード"),
        type: z
          .enum(["skill", "prompt", "external"])
          .optional()
          .describe("種別で絞り込む(externalは外部OSS等の紹介。未指定なら全種別)"),
        tags: z.array(z.string()).optional().describe("タグ名で絞り込む(すべて一致するAND条件、例: ['デザイン'])"),
        sort: z.enum(SORT_VALUES).optional().describe("並び順(既定: newest=新着順)"),
        page: z.number().int().min(1).optional().describe("ページ番号(既定: 1)"),
        pageSize: z.number().int().min(1).max(50).optional().describe("1ページあたりの件数(既定: 20, 最大: 50)"),
      }),
    },
    async ({ query, type, tags, sort, page, pageSize }) => {
      let tagIds: number[] = [];
      if (tags && tags.length > 0) {
        const names = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (names.length > 0) {
          const placeholders = names.map(() => "?").join(",");
          const { results } = await env.DB.prepare(`SELECT id FROM tags WHERE name IN (${placeholders})`)
            .bind(...names)
            .all<{ id: number }>();
          tagIds = (results ?? []).map((r) => r.id);
          // 指定したタグ名が1つも見つからない場合は、意図的な絞り込みとしてヒットなしを返す
          if (tagIds.length === 0) {
            return {
              content: [{ type: "text", text: JSON.stringify({ items: [], total: 0, page: page ?? 1, pageSize: pageSize ?? 20 }) }],
            };
          }
        }
      }

      const result = await searchItems(env.DB, { type, q: query, tagIds, sort, page, pageSize }, viewerEmail);
      const items = result.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        summary: item.summary,
        version: item.version,
        authorName: item.authorName,
        usageCount: item.usageCount,
        favoriteCount: item.favoriteCount,
        tags: item.tags.map((t) => t.label),
        updatedAt: item.updatedAt,
        url: `${baseUrl}/items/${item.id}`,
      }));
      return {
        content: [
          { type: "text", text: JSON.stringify({ items, total: result.total, page: result.page, pageSize: result.pageSize }, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "スキル・プロンプトの詳細を取得",
      description:
        "指定したIDのスキル/プロンプトの詳細(概要・詳細説明・プロンプト本文または使い方メモ・タグ・作者等)を取得する。",
      inputSchema: z.object({
        id: z.string().describe("アイテムID(search_itemsの結果に含まれるid)"),
      }),
    },
    async ({ id }) => {
      const row = await fetchItemRow(env.DB, id);
      if (!row) {
        return { content: [{ type: "text", text: `アイテムが見つかりません(id=${id})` }], isError: true };
      }
      const [item] = await toItemDTOs(env.DB, [row], viewerEmail);

      const body: Record<string, unknown> = {
        id: item.id,
        type: item.type,
        title: item.title,
        summary: item.summary,
        description: item.description,
        version: item.version,
        authorName: item.authorName,
        authorEmail: item.authorEmail,
        usageCount: item.usageCount,
        favoriteCount: item.favoriteCount,
        tags: item.tags.map((t) => t.label),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        url: `${baseUrl}/items/${item.id}`,
      };
      if (item.type === "prompt") {
        body.promptBody = item.body;
      } else if (item.type === "external") {
        body.sourceUrl = item.sourceUrl;
        body.sourceAuthor = item.sourceAuthor;
        body.license = item.license;
        body.stars = item.stars;
        body.note = "これは第三者が公開しているOSS等の紹介です。著作権は元の作者に帰属します。";
      } else {
        body.usageNote = item.body || null;
        body.fileName = item.fileName;
        body.hasDownloadableSource = Boolean(item.fileName && item.fileName.toLowerCase().endsWith(".md"));
        body.note = body.hasDownloadableSource
          ? "SKILL.mdの内容は get_skill_source ツールで取得できます。"
          : "ZIP形式のためMCP経由では内容を取得できません。ダウンロードはWebサイトから行ってください。";
      }

      return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "タグ一覧を取得",
      description: "search_itemsの絞り込みに使えるタグの一覧(名前・利用件数)を取得する。",
      inputSchema: z.object({}),
    },
    async () => {
      const { results } = await env.DB.prepare(
        `SELECT t.name, t.label, t.is_default, COUNT(it.item_id) as item_count
         FROM tags t
         LEFT JOIN item_tags it ON it.tag_id = t.id
         GROUP BY t.id
         ORDER BY t.is_default DESC, t.label ASC`,
      ).all<{ name: string; label: string; is_default: number; item_count: number }>();

      const tags = (results ?? []).map((t) => ({
        name: t.name,
        label: t.label,
        isDefault: Boolean(t.is_default),
        itemCount: t.item_count,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ tags }, null, 2) }] };
    },
  );

  server.registerTool(
    "get_skill_source",
    {
      title: "SKILL.mdのソースを取得",
      description:
        "SKILL.md単体形式で投稿されたスキルの本文をテキストで取得する。ZIP形式のスキルやプロンプトには使用できない。",
      inputSchema: z.object({
        id: z.string().describe("アイテムID"),
      }),
    },
    async ({ id }) => {
      const row = await fetchItemRow(env.DB, id);
      if (!row) {
        return { content: [{ type: "text", text: `アイテムが見つかりません(id=${id})` }], isError: true };
      }
      if (row.type !== "skill" || !row.r2_key || !row.file_name?.toLowerCase().endsWith(".md")) {
        return {
          content: [{ type: "text", text: "このアイテムはSKILL.md単体形式ではないため、取得できません。" }],
          isError: true,
        };
      }
      const obj = await env.ASSETS_BUCKET.get(row.r2_key);
      if (!obj) {
        return { content: [{ type: "text", text: "ファイルがストレージに見つかりません。" }], isError: true };
      }
      const text = await obj.text();
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "create_item",
    {
      title: "スキル・プロンプト・OSS紹介を新規投稿",
      description:
        "AI Skills Hub に新しいスキル/プロンプト/外部OSS紹介を投稿する。" +
        "type=skillの場合、資産はSKILL.md単体形式(テキスト)のみ対応(ZIP形式はWebサイトから投稿する必要がある)。",
      inputSchema: z.object({
        type: z.enum(["skill", "prompt", "external"]).describe("投稿する種別"),
        title: z.string().min(1).max(200).describe("タイトル(必須)"),
        summary: z.string().max(200).optional().describe("概要(一覧カードに表示。100字程度を推奨)"),
        description: z.string().optional().describe("詳細説明(Markdown対応)"),
        body: z.string().optional().describe("type=promptの場合は本文(必須)。type=skillの場合は使い方メモ(任意)"),
        skillMarkdown: z.string().optional().describe("type=skillの場合のSKILL.md本文(必須)"),
        sourceUrl: z.string().optional().describe("type=externalの場合、紹介先のURL(必須)"),
        sourceAuthor: z.string().optional().describe("type=externalの場合、元の作者/組織(任意)"),
        license: z.string().optional().describe("type=externalの場合、ライセンス(任意)"),
        tags: z
          .array(z.string())
          .optional()
          .describe("タグ名の配列。既存のタグ名に一致すればそれを使い、無ければ新規作成する"),
      }),
    },
    async ({ type, title, summary, description, body, skillMarkdown, sourceUrl, sourceAuthor, license, tags }) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return { content: [{ type: "text", text: "タイトルを入力してください" }], isError: true };

      const bodyText = (body ?? "").trim();
      if (type === "prompt" && !bodyText) {
        return { content: [{ type: "text", text: "プロンプト本文(body)を入力してください" }], isError: true };
      }
      const skillMd = (skillMarkdown ?? "").trim();
      if (type === "skill" && !skillMd) {
        return {
          content: [{ type: "text", text: "SKILL.md本文(skillMarkdown)を入力してください" }],
          isError: true,
        };
      }
      const trimmedSourceUrl = (sourceUrl ?? "").trim();
      if (type === "external") {
        if (!trimmedSourceUrl) {
          return { content: [{ type: "text", text: "紹介先URL(sourceUrl)を入力してください" }], isError: true };
        }
        if (!isValidHttpUrl(trimmedSourceUrl)) {
          return { content: [{ type: "text", text: "sourceUrlは有効なhttp(s) URLである必要があります" }], isError: true };
        }
      }

      const id = crypto.randomUUID();
      const slug = slugify(trimmedTitle);

      let r2Key: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      if (type === "skill") {
        r2Key = `skills/${id}/SKILL.md`;
        fileName = "SKILL.md";
        fileSize = new TextEncoder().encode(skillMd).length;
        await env.ASSETS_BUCKET.put(r2Key, skillMd, {
          httpMetadata: { contentType: "text/markdown; charset=utf-8" },
        });
      }

      const tagIds = tags && tags.length > 0 ? await resolveOrCreateTagIds(env.DB, tags, viewerEmail) : [];

      await env.DB.prepare(
        `INSERT INTO items (id, type, slug, title, summary, description, body, r2_key, file_name, file_size, version, author_email, source_url, source_author, license)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          type,
          slug,
          trimmedTitle,
          summary ?? "",
          description ?? "",
          bodyText,
          r2Key,
          fileName,
          fileSize,
          "1.0.0",
          viewerEmail,
          type === "external" ? trimmedSourceUrl : null,
          type === "external" && sourceAuthor ? sourceAuthor : null,
          type === "external" && license ? license : null,
        )
        .run();

      await applyTags(env.DB, id, tagIds, false);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ id, type, title: trimmedTitle, url: `${baseUrl}/items/${id}` }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_item",
    {
      title: "投稿済みのスキル・プロンプト・OSS紹介を編集",
      description:
        "自分が投稿したアイテムを編集する。指定したフィールドのみ更新し、省略したフィールドは現在の値を維持する。" +
        "type=skillでZIP形式の資産(拡張子.md以外)を投稿済みの場合、skillMarkdownによる資産差し替えはできない(Webサイトから行う必要がある)。" +
        "バージョンは手動指定できず、type=promptならbody、type=skillならskillMarkdownが実際に変わった時のみ" +
        "サーバー側でパッチ番号が自動的に上がる(タグ・説明文等だけの編集や、type=externalの編集ではバージョンは変化しない)。",
      inputSchema: z.object({
        id: z.string().describe("編集するアイテムID"),
        title: z.string().min(1).max(200).optional(),
        summary: z.string().max(200).optional(),
        description: z.string().optional(),
        body: z.string().optional().describe("type=promptなら本文。type=skillなら使い方メモ"),
        skillMarkdown: z.string().optional().describe("type=skillの場合、SKILL.md本文を差し替える(SKILL.md単体投稿のみ)"),
        sourceUrl: z.string().optional().describe("type=externalの場合の紹介先URL"),
        sourceAuthor: z.string().optional(),
        license: z.string().optional(),
        tags: z.array(z.string()).optional().describe("指定した場合、既存のタグ付けをこの配列で全置換する"),
      }),
    },
    async ({ id, title, summary, description, body, skillMarkdown, sourceUrl, sourceAuthor, license, tags }) => {
      const existing = await fetchItemRow(env.DB, id);
      if (!existing) {
        return { content: [{ type: "text", text: `アイテムが見つかりません(id=${id})` }], isError: true };
      }
      if (existing.author_email !== viewerEmail) {
        return { content: [{ type: "text", text: "この投稿を編集する権限がありません" }], isError: true };
      }

      const newTitle = title !== undefined ? title.trim() : existing.title;
      if (!newTitle) return { content: [{ type: "text", text: "タイトルを入力してください" }], isError: true };

      const newSummary = summary ?? existing.summary;
      const newDescription = description ?? existing.description;
      const newBody = body ?? existing.body;
      // バージョンは手動指定を受け付けない。本体(type=promptならbody、type=skillならskillMarkdown)が
      // 実質的に変わった時だけサーバー側でパッチ番号を自動的に上げる。
      const contentChanged =
        existing.type === "prompt"
          ? newBody !== existing.body
          : existing.type === "skill"
            ? skillMarkdown !== undefined
            : false;
      const newVersion = contentChanged ? bumpPatchVersion(existing.version) : existing.version;
      const newSourceUrl = (sourceUrl ?? existing.source_url ?? "").trim();
      const newSourceAuthor = sourceAuthor ?? existing.source_author ?? "";
      const newLicense = license ?? existing.license ?? "";

      if (existing.type === "prompt" && !newBody.trim()) {
        return { content: [{ type: "text", text: "プロンプト本文(body)は空にできません" }], isError: true };
      }
      if (existing.type === "external") {
        if (!newSourceUrl) {
          return { content: [{ type: "text", text: "紹介先URL(sourceUrl)は空にできません" }], isError: true };
        }
        if (!isValidHttpUrl(newSourceUrl)) {
          return { content: [{ type: "text", text: "sourceUrlは有効なhttp(s) URLである必要があります" }], isError: true };
        }
      }

      let r2Key = existing.r2_key;
      let fileName = existing.file_name;
      let fileSize = existing.file_size;
      if (skillMarkdown !== undefined) {
        if (existing.type !== "skill") {
          return { content: [{ type: "text", text: "skillMarkdownはtype=skillの投稿にのみ指定できます" }], isError: true };
        }
        if (existing.file_name && !existing.file_name.toLowerCase().endsWith(".md")) {
          return {
            content: [
              { type: "text", text: "ZIP形式で投稿済みのスキル資産はMCP経由では差し替えできません。Webサイトから編集してください。" },
            ],
            isError: true,
          };
        }
        // バージョンごとに別オブジェクトとして保存する(過去バージョンの参照用に、
        // 既存のファイルを上書きしない)。
        r2Key = `skills/${id}/${Date.now()}-SKILL.md`;
        fileName = "SKILL.md";
        fileSize = new TextEncoder().encode(skillMarkdown).length;
        await env.ASSETS_BUCKET.put(r2Key, skillMarkdown, {
          httpMetadata: { contentType: "text/markdown; charset=utf-8" },
        });
      }

      // バージョンが実際に上がる時は、置き換えられる直前の内容を履歴として残す。
      if (contentChanged) {
        await env.DB.prepare(
          `INSERT INTO item_versions (item_id, version, body, r2_key, file_name, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        )
          .bind(
            id,
            existing.version,
            existing.type === "prompt" ? existing.body : "",
            existing.type === "skill" ? existing.r2_key : null,
            existing.type === "skill" ? existing.file_name : null,
            existing.type === "skill" ? existing.file_size : null,
          )
          .run();
      }

      await env.DB.prepare(
        `UPDATE items SET title=?, summary=?, description=?, body=?, version=?, r2_key=?, file_name=?, file_size=?,
           source_url=?, source_author=?, license=?, updated_at=datetime('now')
         WHERE id=?`,
      )
        .bind(
          newTitle,
          newSummary,
          newDescription,
          newBody,
          newVersion,
          r2Key,
          fileName,
          fileSize,
          existing.type === "external" ? newSourceUrl : null,
          existing.type === "external" && newSourceAuthor ? newSourceAuthor : null,
          existing.type === "external" && newLicense ? newLicense : null,
          id,
        )
        .run();

      if (tags !== undefined) {
        const tagIds = tags.length > 0 ? await resolveOrCreateTagIds(env.DB, tags, viewerEmail) : [];
        await applyTags(env.DB, id, tagIds, true);
      }

      return {
        content: [
          { type: "text", text: JSON.stringify({ id, title: newTitle, url: `${baseUrl}/items/${id}` }, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "set_item_favorite",
    {
      title: "お気に入りの登録/解除",
      description: "指定したアイテムをお気に入りに登録、または解除する。",
      inputSchema: z.object({
        id: z.string().describe("アイテムID"),
        favorited: z.boolean().describe("true: お気に入りに登録する / false: 解除する"),
      }),
    },
    async ({ id, favorited }) => {
      const item = await env.DB.prepare("SELECT id, author_email, version FROM items WHERE id = ?")
        .bind(id)
        .first<Pick<ItemRow, "id" | "author_email" | "version">>();
      if (!item) {
        return { content: [{ type: "text", text: `アイテムが見つかりません(id=${id})` }], isError: true };
      }

      if (favorited) {
        const result = await env.DB.prepare("INSERT OR IGNORE INTO favorites (user_email, item_id) VALUES (?, ?)")
          .bind(viewerEmail, id)
          .run();
        if (result.meta.changes > 0) {
          await env.DB.prepare("UPDATE items SET favorite_count = favorite_count + 1 WHERE id = ?").bind(id).run();
        }
        await markItemWatched(env.DB, viewerEmail, item.author_email, id, item.version, { markSeen: false });
      } else {
        const result = await env.DB.prepare("DELETE FROM favorites WHERE user_email = ? AND item_id = ?")
          .bind(viewerEmail, id)
          .run();
        if (result.meta.changes > 0) {
          await env.DB.prepare("UPDATE items SET favorite_count = MAX(favorite_count - 1, 0) WHERE id = ?")
            .bind(id)
            .run();
        }
      }

      const row = await env.DB.prepare("SELECT favorite_count FROM items WHERE id = ?")
        .bind(id)
        .first<{ favorite_count: number }>();
      return {
        content: [
          { type: "text", text: JSON.stringify({ favorited, favoriteCount: row?.favorite_count ?? 0 }, null, 2) },
        ],
      };
    },
  );

  return server;
}
