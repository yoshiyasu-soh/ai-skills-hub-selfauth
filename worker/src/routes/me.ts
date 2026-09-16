import { Hono } from "hono";
import { z } from "zod";
import { generateToken, hashToken } from "../lib/auth/tokens";
import { fetchUserProfileRow, toUserProfileDTO } from "../lib/userProfile";
import type { AuthUser, Env } from "../types";

const me = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

interface ApiTokenRow {
  id: number;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

// 有効期限は「無期限」または 1〜3650日(約10年)の範囲で日数指定を受け付ける。
const createTokenSchema = z.object({
  label: z.string().trim().max(100).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "表示名を入力してください").max(100),
  givenName: z.string().trim().max(100).optional(),
  surname: z.string().trim().max(100).optional(),
  companyName: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  employeeType: z.string().trim().max(50).optional(),
});

function norm(value?: string): string | null {
  return value && value.length > 0 ? value : null;
}

me.get("/", async (c) => {
  const email = c.get("user").email;
  const row = await fetchUserProfileRow(c.env.DB, email);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ user: toUserProfileDTO(row) });
});

// ---- 自分のプロフィール(表示名・姓名・会社名・役職・部署・従業員の種類)を編集する ----
me.patch("/", async (c) => {
  const email = c.get("user").email;
  const parsed = updateProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, 400);
  }
  const d = parsed.data;

  await c.env.DB.prepare(
    `UPDATE users SET
       display_name = ?,
       given_name = ?,
       surname = ?,
       company_name = ?,
       job_title = ?,
       department = ?,
       employee_type = ?
     WHERE email = ?`,
  )
    .bind(
      d.displayName,
      norm(d.givenName),
      norm(d.surname),
      norm(d.companyName),
      norm(d.jobTitle),
      norm(d.department),
      norm(d.employeeType),
      email,
    )
    .run();

  const row = await fetchUserProfileRow(c.env.DB, email);
  if (!row) return c.json({ error: "internal_error" }, 500);
  return c.json({ user: toUserProfileDTO(row) });
});

// ---- MCPクライアント等から使う個人アクセストークンの一覧(値自体は含まない) ----
me.get("/tokens", async (c) => {
  const email = c.get("user").email;
  const { results } = await c.env.DB.prepare(
    "SELECT id, label, created_at, last_used_at, expires_at FROM api_tokens WHERE user_email = ? ORDER BY created_at DESC",
  )
    .bind(email)
    .all<ApiTokenRow>();

  const tokens = (results ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
  }));
  return c.json({ tokens });
});

// ---- 新規発行。生のトークンはこのレスポンスでのみ返す(DBにはハッシュのみ保存) ----
me.post("/tokens", async (c) => {
  const email = c.get("user").email;
  const parsed = createTokenSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const label = parsed.data.label && parsed.data.label.length > 0 ? parsed.data.label : null;
  const expiresInDays = parsed.data.expiresInDays;

  const expiresAtRow = expiresInDays
    ? await c.env.DB.prepare("SELECT datetime('now', ?) as expires_at").bind(`+${expiresInDays} days`).first<{
        expires_at: string;
      }>()
    : null;
  const expiresAt = expiresAtRow?.expires_at ?? null;

  const result = await c.env.DB.prepare(
    "INSERT INTO api_tokens (token_hash, user_email, label, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, email, label, expiresAt)
    .run();

  return c.json({
    token,
    id: result.meta.last_row_id,
    label,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    expiresAt,
  });
});

// ---- 失効 ----
me.delete("/tokens/:id", async (c) => {
  const email = c.get("user").email;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid_request" }, 400);

  await c.env.DB.prepare("DELETE FROM api_tokens WHERE id = ? AND user_email = ?").bind(id, email).run();
  return c.json({ ok: true });
});

export default me;
