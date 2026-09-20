import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * CLAUDE.mdの「D1マイグレーションで絶対に守ること」で明文化した前提を、
 * スキーマの実態と自動で突き合わせる回帰ガード。
 * 新しいマイグレーションでこの前提が崩れた場合、テーブル再構築(DROP→RENAME)を
 * 書く前に気づけるようにする。
 */

// CLAUDE.md ルール3: items(id) を参照している既知の子テーブル一覧。
// items を再構築するマイグレーションを書く前に、必ずこのリストと退避・復元対象が
// 一致していることを確認すること。新しいテーブルが items を参照するようになったら、
// ここと CLAUDE.md の両方を更新する。
const KNOWN_ITEMS_CHILD_TABLES = [
  "item_tags",
  "favorites",
  "item_watches",
  "usage_events",
  "item_comments",
  "item_versions",
];

async function tablesReferencing(targetTable: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL",
  ).all<{ name: string; sql: string }>();

  return (results ?? [])
    .filter((r) => r.name !== targetTable && new RegExp(`REFERENCES\\s+${targetTable}\\s*\\(`, "i").test(r.sql))
    .map((r) => r.name)
    .sort();
}

describe("スキーマの前提(CLAUDE.md)との整合性", () => {
  it("items(id) を参照するテーブルは既知の一覧と一致する(新規追加時はCLAUDE.mdも更新すること)", async () => {
    const actual = await tablesReferencing("items");
    expect(actual).toEqual([...KNOWN_ITEMS_CHILD_TABLES].sort());
  });

  it("items.type / usage_events.kind にCHECK制約が復活していない(0012で意図的に撤去済み)", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('items', 'usage_events')",
    ).all<{ name: string; sql: string }>();

    for (const row of results ?? []) {
      expect(row.sql, `${row.name} にCHECK制約が含まれている`).not.toMatch(/CHECK\s*\(/i);
    }
  });
});
