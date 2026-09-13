import { Hono } from "hono";
import { z } from "zod";
import { fetchUserProfileRow, toUserProfileDTO } from "../lib/userProfile";
import type { AuthUser, Env } from "../types";

const me = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

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

export default me;
