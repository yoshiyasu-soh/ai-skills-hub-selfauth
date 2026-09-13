import { Hono } from "hono";
import { authMiddleware } from "./auth";
import authRoute from "./routes/auth";
import favoritesRoute from "./routes/favorites";
import itemsRoute from "./routes/items";
import mcpRoute from "./routes/mcp";
import meRoute from "./routes/me";
import notificationsRoute from "./routes/notifications";
import rankingRoute from "./routes/ranking";
import tagsRoute from "./routes/tags";
import usersRoute from "./routes/users";
import type { AuthUser, Env } from "./types";

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// /api/* 以外は wrangler.jsonc の assets.not_found_handling (SPA fallback) が
// 直接処理するため、この Worker では /api/* のみをハンドリングする。
// /api/auth/* (登録・ログイン・パスワードリセット等)はログイン前にも叩く必要があるため
// authMiddleware の対象外とする。
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/auth" || c.req.path.startsWith("/api/auth/")) {
    return next();
  }
  return authMiddleware(c, next);
});

app.route("/api/auth", authRoute);
app.route("/api/items", itemsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api/favorites", favoritesRoute);
app.route("/api/ranking", rankingRoute);
app.route("/api/me", meRoute);
app.route("/api/users", usersRoute);
app.route("/api/notifications", notificationsRoute);
app.route("/api/mcp", mcpRoute);

app.onError((err, c) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "unexpected error";
  return c.json({ error: "internal_error", message }, 500);
});

export default app;
