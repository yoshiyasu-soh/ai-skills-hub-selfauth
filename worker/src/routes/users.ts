import { Hono } from "hono";
import { fetchUserProfileRow, toUserProfileDTO } from "../lib/userProfile";
import type { AuthUser, Env } from "../types";

const users = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// 投稿者など、社内の任意のユーザーのプロフィール(表示名)を閲覧できる。
// 認証済みユーザーであれば誰でも閲覧可能(/api/* は authMiddleware で保護済み)。
users.get("/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email"));
  const row = await fetchUserProfileRow(c.env.DB, email);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ user: toUserProfileDTO(row) });
});

export default users;
