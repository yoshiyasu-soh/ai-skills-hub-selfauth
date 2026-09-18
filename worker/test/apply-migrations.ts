import { applyD1Migrations, env } from "cloudflare:test";

// vitest.config.ts の TEST_MIGRATIONS バインディング経由で migrations/ の内容を渡し、
// 各テストファイル実行前にテスト用D1へ適用する(本番と同じマイグレーションファイルを使う)。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
