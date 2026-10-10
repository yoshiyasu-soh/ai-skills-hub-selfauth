import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/index";

const SECRET_DETAIL = "D1_ERROR: no such column: password_hash_internal";

// DB呼び出しの時点で内部エラーを起こすD1の代わり
const brokenDb = {
  prepare() {
    throw new Error(SECRET_DETAIL);
  },
} as unknown as D1Database;

describe("予期しないエラーの応答", () => {
  it("本番環境では内部エラーの詳細を返さない", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer dummy" } },
      { ...env, ENVIRONMENT: "production", DB: brokenDb },
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(SECRET_DETAIL);
  });

  it("開発環境では原因調査のため内部エラーの詳細を返す", async () => {
    const res = await app.request(
      "/api/me",
      { headers: { Authorization: "Bearer dummy" } },
      { ...env, ENVIRONMENT: "development", DB: brokenDb },
    );
    expect(res.status).toBe(500);
    expect(await res.text()).toContain(SECRET_DETAIL);
  });
});
