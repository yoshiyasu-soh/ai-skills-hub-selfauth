import type { D1Migration } from "@cloudflare/vitest-plugin";
import type { Env as WorkerEnv } from "../src/types";

// cloudflare:test の `env` は Cloudflare.Env(@cloudflare/workers-types が宣言する、
// プロジェクト側で拡張することを前提にした空インターフェース)の型で公開される。
// 実際のバインディング型(WorkerEnv)と、vitest.config.tsで渡すテスト専用の
// TEST_MIGRATIONS を合成する。
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
