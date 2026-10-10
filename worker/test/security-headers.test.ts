import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("APIレスポンスのセキュリティヘッダー", () => {
  it("MIMEタイプの推測・フレーム埋め込み・アクティブコンテンツの実行を禁止する", async () => {
    const res = await SELF.fetch("https://example.com/api/me");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("認証不要のエンドポイント(/api/auth/*)にも付与する", async () => {
    const res = await SELF.fetch("https://example.com/api/auth/logout", { method: "POST" });

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
