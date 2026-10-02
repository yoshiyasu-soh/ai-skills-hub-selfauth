import { describe, expect, it } from "vitest";
import { parseDoc } from "./parseDoc";
import { findRanges, searchDoc } from "./search";

const doc = parseDoc({
  path: "SKILL.md",
  kind: "markdown",
  source: [
    "---",
    "name: demo",
    "---",
    "# Demo",
    "",
    "Design の導入",
    "",
    "## Setup",
    "",
    "インストール手順 (v1.0) [x]",
    "",
    "## Design Tips",
    "",
    "ＤＥＳＩＧＮ は全角でも一致する",
  ].join("\n"),
});

describe("findRanges", () => {
  it("大文字小文字・全角半角を区別しない", () => {
    expect(findRanges("Design ＤＥＳＩＧＮ", "design")).toEqual([
      [0, 6],
      [7, 13],
    ]);
  });

  it("正規表現の特殊文字を入力してもエラーにならない", () => {
    for (const q of ["(", "[", ".", "*", "\\", "(v1.0)"]) {
      expect(() => findRanges("a (v1.0) [x] .*", q)).not.toThrow();
    }
    expect(findRanges("a (v1.0) b", "(v1.0)")).toEqual([[2, 8]]);
    expect(findRanges("abc", ".")).toEqual([]);
  });

  it("空クエリは一致なし", () => {
    expect(findRanges("abc", "  ")).toEqual([]);
  });
});

describe("searchDoc", () => {
  it("見出し一致が本文一致より先に並ぶ", () => {
    const hits = searchDoc(doc, "design");
    expect(hits[0]).toMatchObject({ kind: "heading", sectionId: "section-3" });
    expect(hits.slice(1).every((h) => h.kind === "body")).toBe(true);
    expect(hits.some((h) => h.sectionId === "intro")).toBe(true);
  });

  it("一致行は原文の行番号を指す", () => {
    const hits = searchDoc(doc, "インストール");
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(10);
    expect(hits[0].ranges).toEqual([[0, 6]]);
  });

  it("特殊文字でも落ちず、一致は返る", () => {
    expect(searchDoc(doc, "(v1.0)")).toHaveLength(1);
    expect(searchDoc(doc, "[")).toHaveLength(1);
  });

  it("空クエリは空、テキストファイルは行単位の本文一致", () => {
    expect(searchDoc(doc, "")).toEqual([]);
    const text = parseDoc({ path: "a.txt", kind: "text", source: "x\nDesign" });
    expect(searchDoc(text, "design")).toMatchObject([{ sectionId: "file", kind: "body", line: 2 }]);
  });
});
