import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// migrations/ 配下の全マイグレーションを読み込み、テスト用D1に自動適用する
// (worker/test/apply-migrations.ts で使用)。
const migrations = await readD1Migrations(path.join(import.meta.dirname, "../migrations"));

export default defineConfig({
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
  plugins: [
    cloudflareTest({
      // wrangler.jsonc は本番の資源IDを含むためGit管理対象外(.gitignore)。テストは
      // 本番設定と切り離した専用の wrangler.test.jsonc を設定源にする
      // (拡張子は .jsonc である必要がある。.example 等だとバインディングが読み込まれない)。
      wrangler: { configPath: path.join(import.meta.dirname, "wrangler.test.jsonc") },
      miniflare: {
        // テスト用のバインディングとしてマイグレーション定義を渡す
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
});
