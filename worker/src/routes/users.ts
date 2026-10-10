import { Hono } from "hono";
import { fetchUserProfileRowByPublicId, toPublicUserProfileDTO } from "../lib/userProfile";
import type { AuthUser, Env } from "../types";

const users = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// 投稿者など、任意のユーザーのプロフィールを公開IDで閲覧できる(メールアドレスは含めない)。
// 認証済みユーザーであれば誰でも閲覧可能(/api/* は authMiddleware で保護済み)。
users.get("/:id", async (c) => {
  const row = await fetchUserProfileRowByPublicId(c.env.DB, c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ user: toPublicUserProfileDTO(row) });
});

export default users;
