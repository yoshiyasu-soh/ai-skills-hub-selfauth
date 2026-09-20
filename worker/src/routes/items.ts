import type { Context } from "hono";
import { Hono } from "hono";
import { toCommentDTO, type CommentRow } from "../lib/comments";
import { applyTags, bumpPatchVersion, fetchItemRow, isValidHttpUrl, parseTagIds, searchItems, toItemDTOs } from "../lib/items";
import { slugify } from "../lib/slug";
import { toVersionDTO, type VersionRow } from "../lib/versions";
import { markItemSeen, markItemWatched } from "../lib/watches";
import type { AuthUser, Env, SortOption } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: { user: AuthUser } }>;

const items = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

const MAX_SKILL_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// スキル資産として許可する拡張子。ZIP一式 or SKILL.md単体のどちらでも投稿できる。
const ALLOWED_SKILL_EXTENSIONS = [".zip", ".md"];

/**
 * DL数/コピー数を加算すべきかどうかを判定する(ユニークユーザー数としてカウントする)。
 * - 投稿者本人による実行はカウントしない(自分の投稿を試すたびに数字が伸びるのを防ぐ)
 * - 同じ人・同じ項目・同じ種別の操作は、過去に一度でもあれば以後は何度実行してもカウントしない
 */
async function shouldCountUsage(
  db: D1Database,
  itemId: string,
  userEmail: string,
  authorEmail: string,
  kind: "download" | "copy" | "visit",
): Promise<boolean> {
  if (userEmail === authorEmail) return false;

  const existing = await db
    .prepare(`SELECT id FROM usage_events WHERE item_id = ? AND user_email = ? AND kind = ? LIMIT 1`)
    .bind(itemId, userEmail, kind)
    .first();

  return !existing;
}

type Fields = Record<string, unknown>;

function isAllowedSkillFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_SKILL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function contentTypeForFileName(fileName: string): string {
  return fileName.toLowerCase().endsWith(".md") ? "text/markdown; charset=utf-8" : "application/zip";
}

async function readBody(c: AppContext): Promise<{ fields: Fields; file?: File }> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });
    const file = body["file"] instanceof File && body["file"].size > 0 ? (body["file"] as File) : undefined;
    return { fields: body as Fields, file };
  }
  const json = (await c.req.json().catch(() => ({}))) as Fields;
  return { fields: json };
}

function str(fields: Fields, key: string, fallback = ""): string {
  const v = fields[key];
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
}

/** 非負整数として解釈できない値(未指定・空文字・NaN等)は null として扱う */
function nonNegativeIntOrNull(fields: Fields, key: string): number | null {
  const v = fields[key];
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

// ---- 一覧: type / タグ(AND) / 文字列検索 / ソート / ページング ----
items.get("/", async (c) => {
  const user = c.get("user");
  const typeParam = c.req.query("type");
  const tagsParam = c.req.query("tags");
  const authorEmailParam = c.req.query("authorEmail");

  const tagIds = (tagsParam ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);

  const result = await searchItems(
    c.env.DB,
    {
      type:
        typeParam === "skill" || typeParam === "prompt" || typeParam === "external" ? typeParam : undefined,
      q: c.req.query("q"),
      tagIds,
      authorEmail: authorEmailParam ? (authorEmailParam === "me" ? user.email : authorEmailParam) : undefined,
      sort: (c.req.query("sort") as SortOption) || "newest",
      page: Number(c.req.query("page") ?? "1"),
      pageSize: Number(c.req.query("pageSize") ?? "20"),
    },
    user.email,
  );
  return c.json(result);
});

// ---- 外部紹介の投稿フォーム用: GitHubリポジトリのメタデータを自動取得する ----
// (GET /:id と衝突しないよう、動的パラメータ付きルートより前に定義しておく)
items.get("/fetch-metadata", async (c) => {
  const urlParam = c.req.query("url");
  if (!urlParam) return c.json({ error: "url is required" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(urlParam);
  } catch {
    return c.json({ error: "invalid url" }, 400);
  }

  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    return c.json({ error: "only github.com URLs are supported for auto-fetch" }, 400);
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return c.json({ error: "could not parse owner/repo from URL" }, 400);
  }
  const [owner, repo] = parts;

  const headers: Record<string, string> = {
    "User-Agent": "ai-skills-hub-selfauth",
    Accept: "application/vnd.github+json",
  };
  if (c.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${c.env.GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${encodeURIComponent(repo)}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return c.json({ error: "repository not found" }, 404);
    if (res.status === 403) return c.json({ error: "github_rate_limited", message: "GitHub APIのレート制限に達しました" }, 429);
    return c.json({ error: "failed to fetch repository metadata" }, 502);
  }

  const data = (await res.json()) as {
    name?: string;
    description?: string | null;
    owner?: { login?: string };
    license?: { spdx_id?: string } | null;
    stargazers_count?: number;
    html_url?: string;
  };

  return c.json({
    title: data.name ?? repo,
    description: data.description ?? "",
    author: data.owner?.login ?? owner,
    license: data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION" ? data.license.spdx_id : "",
    stars: data.stargazers_count ?? 0,
    url: data.html_url ?? urlParam,
  });
});

// ---- 新規投稿(スキル: multipart+zip / プロンプト: JSON / 外部紹介: JSON) ----
items.post("/", async (c) => {
  const user = c.get("user");
  const { fields, file } = await readBody(c);

  const type = str(fields, "type");
  const title = str(fields, "title");
  const summary = str(fields, "summary");
  const description = str(fields, "description");
  // バージョンは常に1.0.0から始まり、以降は本体(プロンプト本文/添付ファイル)の更新時にのみ
  // サーバー側で自動的に上がる(手動入力は受け付けない)。
  const version = "1.0.0";
  const bodyText = str(fields, "body");
  const tagIds = parseTagIds(fields["tagIds"]);
  const sourceUrl = str(fields, "sourceUrl");
  const sourceAuthor = str(fields, "sourceAuthor");
  const license = str(fields, "license");
  const stars = nonNegativeIntOrNull(fields, "stars");

  if (type !== "skill" && type !== "prompt" && type !== "external") {
    return c.json({ error: "type must be 'skill', 'prompt' or 'external'" }, 400);
  }
  if (!title) return c.json({ error: "title is required" }, 400);
  if (title.length > 200) return c.json({ error: "title is too long (max 200 chars)" }, 400);
  if (type === "prompt" && !bodyText) return c.json({ error: "body (prompt text) is required" }, 400);
  if (type === "skill" && !file) return c.json({ error: "file (.zip or .md) is required" }, 400);
  if (type === "external") {
    if (!sourceUrl) return c.json({ error: "sourceUrl is required" }, 400);
    if (!isValidHttpUrl(sourceUrl)) return c.json({ error: "sourceUrl must be a valid http(s) URL" }, 400);
  }

  const id = crypto.randomUUID();
  const slug = slugify(title);

  let r2Key: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (type === "skill" && file) {
    if (!isAllowedSkillFile(file.name)) {
      return c.json({ error: "file must be a .zip archive or a SKILL.md (.md) file" }, 400);
    }
    if (file.size > MAX_SKILL_FILE_SIZE) {
      return c.json({ error: `file too large (max ${MAX_SKILL_FILE_SIZE / 1024 / 1024}MB)` }, 400);
    }

    r2Key = `skills/${id}/${file.name}`;
    fileName = file.name;
    fileSize = file.size;
    await c.env.ASSETS_BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: contentTypeForFileName(file.name) },
    });
  }

  await c.env.DB.prepare(
    `INSERT INTO items (id, type, slug, title, summary, description, body, r2_key, file_name, file_size, version, author_email, source_url, source_author, license, stars)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      type,
      slug,
      title,
      summary,
      description,
      bodyText,
      r2Key,
      fileName,
      fileSize,
      version,
      user.email,
      type === "external" ? sourceUrl : null,
      type === "external" && sourceAuthor ? sourceAuthor : null,
      type === "external" && license ? license : null,
      type === "external" ? stars : null,
    )
    .run();

  await applyTags(c.env.DB, id, tagIds, false);

  const row = await fetchItemRow(c.env.DB, id);
  if (!row) return c.json({ error: "internal_error" }, 500);
  const [dto] = await toItemDTOs(c.env.DB, [row], user.email);
  return c.json({ item: dto }, 201);
});

// ---- 詳細 ----
items.get("/:id", async (c) => {
  const user = c.get("user");
  const row = await fetchItemRow(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  const [dto] = await toItemDTOs(c.env.DB, [row], user.email);
  // 「更新あり」を一度表示した後、詳細を見た時点で既読にする
  await markItemSeen(c.env.DB, user.email, row.id, row.version);
  return c.json({ item: dto });
});

// ---- 更新(投稿者のみ) ----
items.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await fetchItemRow(c.env.DB, id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.author_email !== user.email) return c.json({ error: "forbidden" }, 403);

  const { fields, file } = await readBody(c);

  const title = fields["title"] !== undefined ? str(fields, "title") : existing.title;
  const summary = fields["summary"] !== undefined ? str(fields, "summary") : existing.summary;
  const description = fields["description"] !== undefined ? str(fields, "description") : existing.description;
  const bodyText = fields["body"] !== undefined ? str(fields, "body") : existing.body;
  const tagIds = fields["tagIds"] !== undefined ? parseTagIds(fields["tagIds"]) : undefined;
  const sourceUrl = fields["sourceUrl"] !== undefined ? str(fields, "sourceUrl") : (existing.source_url ?? "");
  const sourceAuthor =
    fields["sourceAuthor"] !== undefined ? str(fields, "sourceAuthor") : (existing.source_author ?? "");
  const license = fields["license"] !== undefined ? str(fields, "license") : (existing.license ?? "");
  const stars = fields["stars"] !== undefined ? nonNegativeIntOrNull(fields, "stars") : existing.stars;

  // バージョンは手動入力を受け付けない。本体(プロンプト本文/添付ファイル)が実質的に
  // 変わった時だけサーバー側でパッチ番号を自動的に上げる。タグ・説明文だけの編集や、
  // 外部紹介(OSS紹介)の編集ではバージョンは変化しない。
  const contentChanged =
    existing.type === "prompt"
      ? bodyText !== existing.body
      : existing.type === "skill"
        ? Boolean(file)
        : false;
  const version = contentChanged ? bumpPatchVersion(existing.version) : existing.version;

  if (!title) return c.json({ error: "title is required" }, 400);
  if (existing.type === "prompt" && !bodyText) return c.json({ error: "body is required for prompt" }, 400);
  if (existing.type === "external") {
    if (!sourceUrl) return c.json({ error: "sourceUrl is required" }, 400);
    if (!isValidHttpUrl(sourceUrl)) return c.json({ error: "sourceUrl must be a valid http(s) URL" }, 400);
  }

  let r2Key = existing.r2_key;
  let fileName = existing.file_name;
  let fileSize = existing.file_size;

  if (existing.type === "skill" && file) {
    if (!isAllowedSkillFile(file.name)) {
      return c.json({ error: "file must be a .zip archive or a SKILL.md (.md) file" }, 400);
    }
    if (file.size > MAX_SKILL_FILE_SIZE) {
      return c.json({ error: `file too large (max ${MAX_SKILL_FILE_SIZE / 1024 / 1024}MB)` }, 400);
    }

    // バージョンごとに別オブジェクトとして保存する(過去バージョンの参照用に、同名で
    // 再アップロードしても既存のファイルを上書き・削除しない)。
    const newKey = `skills/${id}/${Date.now()}-${file.name}`;
    await c.env.ASSETS_BUCKET.put(newKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: contentTypeForFileName(file.name) },
    });
    r2Key = newKey;
    fileName = file.name;
    fileSize = file.size;
  }

  // バージョンが実際に上がる時は、置き換えられる直前の内容を履歴として残す。
  if (contentChanged) {
    await c.env.DB.prepare(
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

  await c.env.DB.prepare(
    `UPDATE items SET title=?, summary=?, description=?, body=?, version=?, r2_key=?, file_name=?, file_size=?,
       source_url=?, source_author=?, license=?, stars=?, updated_at=datetime('now')
     WHERE id=?`,
  )
    .bind(
      title,
      summary,
      description,
      bodyText,
      version,
      r2Key,
      fileName,
      fileSize,
      existing.type === "external" ? sourceUrl : null,
      existing.type === "external" && sourceAuthor ? sourceAuthor : null,
      existing.type === "external" && license ? license : null,
      existing.type === "external" ? stars : null,
      id,
    )
    .run();

  if (tagIds !== undefined) {
    await applyTags(c.env.DB, id, tagIds, true);
  }

  const row = await fetchItemRow(c.env.DB, id);
  if (!row) return c.json({ error: "internal_error" }, 500);
  const [dto] = await toItemDTOs(c.env.DB, [row], user.email);
  return c.json({ item: dto });
});

// ---- 削除(投稿者のみ) ----
items.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const existing = await fetchItemRow(c.env.DB, id);
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (existing.author_email !== user.email) return c.json({ error: "forbidden" }, 403);

  if (existing.r2_key) {
    await c.env.ASSETS_BUCKET.delete(existing.r2_key);
  }
  const { results: oldVersionFiles } = await c.env.DB.prepare(
    "SELECT r2_key FROM item_versions WHERE item_id = ? AND r2_key IS NOT NULL",
  )
    .bind(id)
    .all<{ r2_key: string }>();
  for (const v of oldVersionFiles ?? []) {
    await c.env.ASSETS_BUCKET.delete(v.r2_key);
  }

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM favorites WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM usage_events WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM item_comments WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM item_versions WHERE item_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id),
  ]);

  return c.json({ ok: true });
});

// ---- スキルのZIPダウンロード(DL数カウント) ----
items.get("/:id/download", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await fetchItemRow(c.env.DB, id);
  if (!item) return c.json({ error: "not_found" }, 404);
  if (item.type !== "skill" || !item.r2_key) return c.json({ error: "this item has no downloadable file" }, 400);

  const obj = await c.env.ASSETS_BUCKET.get(item.r2_key);
  if (!obj) return c.json({ error: "file not found in storage" }, 404);

  if (await shouldCountUsage(c.env.DB, id, user.email, item.author_email, "download")) {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO usage_events (item_id, user_email, kind) VALUES (?, ?, 'download')").bind(id, user.email),
      c.env.DB.prepare("UPDATE items SET usage_count = usage_count + 1 WHERE id = ?").bind(id),
    ]);
  }
  // 最新の中身を実際に受け取った操作なので、保留中の「更新あり」があれば解消する
  await markItemWatched(c.env.DB, user.email, item.author_email, id, item.version, { markSeen: true });

  const fileName = item.file_name ?? "skill.zip";
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentTypeForFileName(fileName),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(obj.size),
    },
  });
});

// ---- 過去バージョンの一覧(古い順)。外部紹介(OSS紹介)にはバージョン概念が無いため対象外 ----
items.get("/:id/versions", async (c) => {
  const item = await c.env.DB.prepare("SELECT id, type FROM items WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; type: string }>();
  if (!item) return c.json({ error: "not_found" }, 404);
  if (item.type === "external") return c.json({ versions: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT id, version, body, r2_key, file_name, file_size, created_at
     FROM item_versions WHERE item_id = ? ORDER BY created_at ASC`,
  )
    .bind(item.id)
    .all<VersionRow>();

  return c.json({ versions: (results ?? []).map(toVersionDTO) });
});

// ---- 過去バージョンのスキル資産ダウンロード(DL数のカウント対象外) ----
items.get("/:id/versions/:versionId/download", async (c) => {
  const id = c.req.param("id");
  const versionId = c.req.param("versionId");

  const item = await c.env.DB.prepare("SELECT type FROM items WHERE id = ?").bind(id).first<{ type: string }>();
  if (!item) return c.json({ error: "not_found" }, 404);
  if (item.type !== "skill") return c.json({ error: "this item has no downloadable file" }, 400);

  const version = await c.env.DB.prepare(
    "SELECT r2_key, file_name FROM item_versions WHERE id = ? AND item_id = ?",
  )
    .bind(versionId, id)
    .first<{ r2_key: string | null; file_name: string | null }>();
  if (!version || !version.r2_key) return c.json({ error: "this version has no downloadable file" }, 400);

  const obj = await c.env.ASSETS_BUCKET.get(version.r2_key);
  if (!obj) return c.json({ error: "file not found in storage" }, 404);

  const fileName = version.file_name ?? "skill.zip";
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentTypeForFileName(fileName),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(obj.size),
    },
  });
});

// ---- プロンプトのコピー操作を記録(コピー数カウント) ----
items.post("/:id/copy", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await c.env.DB.prepare("SELECT id, usage_count, author_email, version FROM items WHERE id = ?")
    .bind(id)
    .first<{ id: string; usage_count: number; author_email: string; version: string }>();
  if (!item) return c.json({ error: "not_found" }, 404);

  // 最新の中身を実際に受け取った操作なので、保留中の「更新あり」があれば解消する
  await markItemWatched(c.env.DB, user.email, item.author_email, id, item.version, { markSeen: true });

  if (!(await shouldCountUsage(c.env.DB, id, user.email, item.author_email, "copy"))) {
    return c.json({ usageCount: item.usage_count });
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO usage_events (item_id, user_email, kind) VALUES (?, ?, 'copy')").bind(id, user.email),
    c.env.DB.prepare("UPDATE items SET usage_count = usage_count + 1 WHERE id = ?").bind(id),
  ]);

  return c.json({ usageCount: item.usage_count + 1 });
});

// ---- 外部紹介の紹介先クリックを記録(参照数カウント) ----
items.post("/:id/visit", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await c.env.DB.prepare(
    "SELECT id, type, source_url, usage_count, author_email, version FROM items WHERE id = ?",
  )
    .bind(id)
    .first<{
      id: string;
      type: string;
      source_url: string | null;
      usage_count: number;
      author_email: string;
      version: string;
    }>();
  if (!item) return c.json({ error: "not_found" }, 404);
  if (item.type !== "external" || !item.source_url) {
    return c.json({ error: "this item has no external link" }, 400);
  }

  // 紹介先を実際に開いた操作なので、保留中の「更新あり」があれば解消する
  await markItemWatched(c.env.DB, user.email, item.author_email, id, item.version, { markSeen: true });

  if (!(await shouldCountUsage(c.env.DB, id, user.email, item.author_email, "visit"))) {
    return c.json({ usageCount: item.usage_count });
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO usage_events (item_id, user_email, kind) VALUES (?, ?, 'visit')").bind(id, user.email),
    c.env.DB.prepare("UPDATE items SET usage_count = usage_count + 1 WHERE id = ?").bind(id),
  ]);

  return c.json({ usageCount: item.usage_count + 1 });
});

// ---- お気に入り登録/解除 ----
items.post("/:id/favorite", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const exists = await c.env.DB.prepare("SELECT id, author_email, version FROM items WHERE id = ?")
    .bind(id)
    .first<{ id: string; author_email: string; version: string }>();
  if (!exists) return c.json({ error: "not_found" }, 404);

  const result = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO favorites (user_email, item_id) VALUES (?, ?)",
  )
    .bind(user.email, id)
    .run();

  if (result.meta.changes > 0) {
    await c.env.DB.prepare("UPDATE items SET favorite_count = favorite_count + 1 WHERE id = ?").bind(id).run();
  }
  // お気に入り登録=この項目を追いたいという意思表示。中身を確認したわけではないので、
  // 保留中の「更新あり」はそのままにし、未購読の場合のみ現在バージョンを基準として登録する
  await markItemWatched(c.env.DB, user.email, exists.author_email, id, exists.version, { markSeen: false });

  const row = await c.env.DB.prepare("SELECT favorite_count FROM items WHERE id = ?").bind(id).first<{ favorite_count: number }>();
  return c.json({ favorited: true, favoriteCount: row?.favorite_count ?? 0 });
});

items.delete("/:id/favorite", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const result = await c.env.DB.prepare(
    "DELETE FROM favorites WHERE user_email = ? AND item_id = ?",
  )
    .bind(user.email, id)
    .run();

  if (result.meta.changes > 0) {
    await c.env.DB.prepare("UPDATE items SET favorite_count = MAX(favorite_count - 1, 0) WHERE id = ?").bind(id).run();
  }

  const row = await c.env.DB.prepare("SELECT favorite_count FROM items WHERE id = ?").bind(id).first<{ favorite_count: number }>();
  return c.json({ favorited: false, favoriteCount: row?.favorite_count ?? 0 });
});

const MAX_COMMENT_LENGTH = 2000;

const COMMENT_SELECT = `
  SELECT ic.id as id, ic.item_id as item_id, ic.author_email as author_email,
         ic.body as body, ic.created_at as created_at, u.display_name as author_display_name
  FROM item_comments ic
  JOIN users u ON u.email = ic.author_email
`;

// ---- コメント一覧取得(投稿日時の古い順) ----
items.get("/:id/comments", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await c.env.DB.prepare("SELECT author_email FROM items WHERE id = ?")
    .bind(id)
    .first<{ author_email: string }>();
  if (!item) return c.json({ error: "not_found" }, 404);

  const { results } = await c.env.DB.prepare(`${COMMENT_SELECT} WHERE ic.item_id = ? ORDER BY ic.created_at ASC`)
    .bind(id)
    .all<CommentRow>();

  const comments = (results ?? []).map((r) => toCommentDTO(r, user.email, item.author_email));
  return c.json({ comments });
});

// ---- コメント投稿 ----
items.post("/:id/comments", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await c.env.DB.prepare("SELECT author_email FROM items WHERE id = ?")
    .bind(id)
    .first<{ author_email: string }>();
  if (!item) return c.json({ error: "not_found" }, 404);

  const { fields } = await readBody(c);
  const body = str(fields, "body");
  if (!body) return c.json({ error: "body is required" }, 400);
  if (body.length > MAX_COMMENT_LENGTH) {
    return c.json({ error: `body must be ${MAX_COMMENT_LENGTH} characters or fewer` }, 400);
  }

  const result = await c.env.DB.prepare("INSERT INTO item_comments (item_id, author_email, body) VALUES (?, ?, ?)")
    .bind(id, user.email, body)
    .run();

  const row = await c.env.DB.prepare(`${COMMENT_SELECT} WHERE ic.id = ?`)
    .bind(result.meta.last_row_id)
    .first<CommentRow>();
  if (!row) return c.json({ error: "internal_error" }, 500);

  return c.json({ comment: toCommentDTO(row, user.email, item.author_email) }, 201);
});

// ---- コメント削除(投稿者本人、またはそのアイテムの投稿者による削除) ----
items.delete("/:id/comments/:commentId", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const commentId = c.req.param("commentId");

  const comment = await c.env.DB.prepare(
    `SELECT ic.author_email as author_email, i.author_email as item_author_email
     FROM item_comments ic JOIN items i ON i.id = ic.item_id
     WHERE ic.id = ? AND ic.item_id = ?`,
  )
    .bind(commentId, id)
    .first<{ author_email: string; item_author_email: string }>();
  if (!comment) return c.json({ error: "not_found" }, 404);
  if (comment.author_email !== user.email && comment.item_author_email !== user.email) {
    return c.json({ error: "forbidden" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM item_comments WHERE id = ?").bind(commentId).run();
  return c.json({ ok: true });
});

export default items;
