import type { ItemRow, SortOption } from "../types";

export interface ItemDTO {
  id: string;
  type: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  body: string;
  fileName: string | null;
  fileSize: number | null;
  version: string;
  authorEmail: string;
  authorName: string;
  usageCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  tags: { id: number; name: string; label: string }[];
  isFavorited: boolean;
  isOwner: boolean;
  hasUpdate: boolean;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  license: string | null;
}

type RowWithAuthor = ItemRow & { author_display_name?: string };

/**
 * items テーブルの行配列を、タグ・お気に入り状態を付与した DTO に変換する。
 * N+1 を避けるため、対象アイテムIDをまとめてタグ/お気に入りテーブルに問い合わせる。
 */
export async function toItemDTOs(
  db: D1Database,
  rows: RowWithAuthor[],
  viewerEmail: string,
): Promise<ItemDTO[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const idPlaceholders = ids.map(() => "?").join(",");

  const tagRowsResult = await db
    .prepare(
      `SELECT it.item_id as item_id, t.id as tag_id, t.name as name, t.label as label
       FROM item_tags it JOIN tags t ON t.id = it.tag_id
       WHERE it.item_id IN (${idPlaceholders})`,
    )
    .bind(...ids)
    .all<{ item_id: string; tag_id: number; name: string; label: string }>();

  const favRowsResult = await db
    .prepare(
      `SELECT item_id FROM favorites WHERE user_email = ? AND item_id IN (${idPlaceholders})`,
    )
    .bind(viewerEmail, ...ids)
    .all<{ item_id: string }>();

  const watchRowsResult = await db
    .prepare(
      `SELECT item_id, last_seen_version FROM item_watches WHERE user_email = ? AND item_id IN (${idPlaceholders})`,
    )
    .bind(viewerEmail, ...ids)
    .all<{ item_id: string; last_seen_version: string }>();

  const tagsByItem = new Map<string, { id: number; name: string; label: string }[]>();
  for (const t of tagRowsResult.results ?? []) {
    const list = tagsByItem.get(t.item_id) ?? [];
    list.push({ id: t.tag_id, name: t.name, label: t.label });
    tagsByItem.set(t.item_id, list);
  }

  const favSet = new Set((favRowsResult.results ?? []).map((f) => f.item_id));
  const lastSeenByItem = new Map((watchRowsResult.results ?? []).map((w) => [w.item_id, w.last_seen_version]));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    description: r.description,
    body: r.body,
    fileName: r.file_name,
    fileSize: r.file_size,
    version: r.version,
    authorEmail: r.author_email,
    authorName: r.author_display_name ?? r.author_email.split("@")[0],
    usageCount: r.usage_count,
    favoriteCount: r.favorite_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    tags: tagsByItem.get(r.id) ?? [],
    isFavorited: favSet.has(r.id),
    isOwner: r.author_email === viewerEmail,
    hasUpdate: lastSeenByItem.has(r.id) && lastSeenByItem.get(r.id) !== r.version,
    sourceUrl: r.source_url,
    sourceAuthor: r.source_author,
    license: r.license,
  }));
}

export interface SearchItemsParams {
  type?: "skill" | "prompt" | "external";
  q?: string;
  tagIds?: number[];
  /** "me" ではなく、呼び出し側で解決済みの実メールアドレスを渡すこと */
  authorEmail?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

/**
 * 一覧取得の絞り込み・ソート・ページングロジック本体。
 * REST の GET /api/items と MCP の search_items ツールの両方から利用する。
 */
export async function searchItems(
  db: D1Database,
  params: SearchItemsParams,
  viewerEmail: string,
): Promise<{ items: ItemDTO[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.type === "skill" || params.type === "prompt" || params.type === "external") {
    conditions.push("i.type = ?");
    values.push(params.type);
  }

  const q = params.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push("(LOWER(i.title) LIKE ? OR LOWER(i.summary) LIKE ? OR LOWER(i.description) LIKE ?)");
    values.push(like, like, like);
  }

  if (params.authorEmail) {
    conditions.push("i.author_email = ?");
    values.push(params.authorEmail);
  }

  const tagIds = (params.tagIds ?? []).filter((v) => Number.isFinite(v) && v > 0);
  if (tagIds.length > 0) {
    const placeholders = tagIds.map(() => "?").join(",");
    conditions.push(
      `i.id IN (SELECT item_id FROM item_tags WHERE tag_id IN (${placeholders}) GROUP BY item_id HAVING COUNT(DISTINCT tag_id) = ?)`,
    );
    values.push(...tagIds, tagIds.length);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sort = params.sort ?? "newest";
  const orderBy =
    sort === "popular"
      ? "i.usage_count DESC"
      : sort === "favorites"
        ? "i.favorite_count DESC"
        : sort === "name"
          ? "i.title COLLATE NOCASE ASC"
          : sort === "updated"
            ? "i.updated_at DESC"
            : "i.created_at DESC";

  const countRow = await db
    .prepare(`SELECT COUNT(*) as cnt FROM items i ${where}`)
    .bind(...values)
    .first<{ cnt: number }>();
  const total = countRow?.cnt ?? 0;

  const offset = (page - 1) * pageSize;
  const { results } = await db
    .prepare(
      `SELECT i.*, u.display_name as author_display_name
       FROM items i JOIN users u ON u.email = i.author_email
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .bind(...values, pageSize, offset)
    .all<ItemRow & { author_display_name: string }>();

  const items = await toItemDTOs(db, results ?? [], viewerEmail);
  return { items, total, page, pageSize };
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * アイテムのタグ付けを行う。REST の投稿/更新と MCP の create_item/update_item ツールの両方から利用する。
 * replace=true の場合、既存のタグ付けを一旦すべて削除してから付け直す(更新時の全置換)。
 */
export async function applyTags(db: D1Database, itemId: string, tagIds: number[], replace: boolean) {
  if (replace) {
    await db.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(itemId).run();
  }
  if (tagIds.length === 0) return;

  const placeholders = tagIds.map(() => "?").join(",");
  const validTags = await db
    .prepare(`SELECT id FROM tags WHERE id IN (${placeholders})`)
    .bind(...tagIds)
    .all<{ id: number }>();
  const validIds = (validTags.results ?? []).map((t) => t.id);
  if (validIds.length === 0) return;

  const stmts = validIds.map((tagId) =>
    db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").bind(itemId, tagId),
  );
  await db.batch(stmts);
}

/**
 * タグ名の配列から対応するタグIDを解決する。存在しない名前は(投稿画面のタグ追加と同様に)
 * その場で新規作成する。空白のみの名前・30文字超の名前は無視する。
 */
export async function resolveOrCreateTagIds(db: D1Database, names: string[], createdBy: string): Promise<number[]> {
  const ids: number[] = [];
  for (const raw of names) {
    const label = raw.trim();
    if (!label || label.length > 30) continue;
    const name = label.toLowerCase();

    const existing = await db.prepare("SELECT id FROM tags WHERE name = ?").bind(name).first<{ id: number }>();
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const result = await db
      .prepare("INSERT INTO tags (name, label, is_default, created_by) VALUES (?, ?, 0, ?)")
      .bind(name, label, createdBy)
      .run();
    ids.push(Number(result.meta.last_row_id));
  }
  return Array.from(new Set(ids));
}

export async function fetchItemRow(db: D1Database, id: string): Promise<RowWithAuthor | null> {
  return db
    .prepare(
      `SELECT i.*, u.display_name as author_display_name
       FROM items i JOIN users u ON u.email = i.author_email
       WHERE i.id = ?`,
    )
    .bind(id)
    .first<RowWithAuthor>();
}

/**
 * multipart/form-data の tagIds フィールドを number[] に正規化する。
 * JSON配列文字列("[1,2]")・単一値・同名複数フィールドのいずれにも対応する。
 */
export function parseTagIds(raw: unknown): number[] {
  if (raw == null) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const ids: number[] = [];

  for (const v of values) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            const n = Number(p);
            if (Number.isFinite(n)) ids.push(n);
          }
          continue;
        }
      } catch {
        // JSON以外の文字列だった場合は下の数値変換にフォールバックする
      }
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) ids.push(n);
  }

  return Array.from(new Set(ids));
}
