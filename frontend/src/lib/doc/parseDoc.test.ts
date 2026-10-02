import { describe, expect, it } from "vitest";
import { parseDoc } from "./parseDoc";
import { estimateTokens } from "./tokens";

const md = (source: string) => parseDoc({ path: "SKILL.md", kind: "markdown", source });

const FENCE = "```";
const SAMPLE = [
  "---",
  "name: demo",
  "description: >",
  "  長い",
  "  説明",
  "license: MIT",
  "---",
  "",
  "# Demo",
  "",
  "導入文です。",
  "",
  "## First",
  "",
  "本文A",
  "",
  "### Sub",
  "",
  "詳細",
  "",
  "## Second",
  "",
  FENCE + "bash",
  "# これは見出しではない",
  "## これも違う",
  FENCE,
  "",
  "本文B",
  "",
].join("\n");

describe("parseDoc(markdown)", () => {
  const doc = md(SAMPLE);

  it("フロントマターを抽出する(折りたたみ値を含む)", () => {
    expect(doc.frontmatter).toEqual({ name: "demo", description: "長い 説明", license: "MIT" });
  });

  it("コードブロック内の # を見出しと誤認しない", () => {
    expect(doc.headings.map((h) => [h.level, h.text])).toEqual([
      [1, "Demo"],
      [2, "First"],
      [3, "Sub"],
      [2, "Second"],
    ]);
  });

  it("見出しIDは出現順の連番で重複しない", () => {
    expect(doc.headings.map((h) => h.id)).toEqual(["section-1", "section-2", "section-3", "section-4"]);
  });

  it("導入 + H2ごとにセクション分割し、H3は同じスライドに含める", () => {
    expect(doc.sections.map((s) => s.title)).toEqual(["Introduction", "First", "Second"]);
    expect(doc.sections[0].body).toBe("導入文です。");
    expect(doc.sections[1].body).toContain("### Sub");
    expect(doc.sections[2].body).toContain("# これは見出しではない");
  });

  it("startLine は原文の行番号(1始まり)", () => {
    const lines = SAMPLE.split("\n");
    expect(lines[doc.sections[1].startLine - 1]).toBe("## First");
  });

  it("全スライドのトークン合計が総数に一致する", () => {
    const sum = doc.coverTokenCount + doc.sections.reduce((s, x) => s + x.tokenCount, 0);
    expect(doc.totalTokenCount).toBe(sum);
    expect(doc.coverTokenCount).toBeGreaterThan(0);
  });

  it("renderSource はフロントマターを除き行番号を保つ", () => {
    expect(doc.renderSource.split("\n").length).toBe(SAMPLE.split("\n").length);
    expect(doc.renderSource).not.toContain("license: MIT");
  });

  it("導入が空なら導入スライドを作らず、合計は一致する", () => {
    const d = md("# T\n\n## A\n\nx\n");
    expect(d.sections.map((s) => s.title)).toEqual(["A"]);
    expect(d.totalTokenCount).toBe(d.coverTokenCount + d.sections[0].tokenCount);
  });

  it("フロントマターも見出しも無い場合は導入のみ", () => {
    const d = md("ただの文章");
    expect(d.sections.map((s) => s.title)).toEqual(["Introduction"]);
    expect(d.headings).toEqual([]);
  });

  it("CRLFを扱える", () => {
    const d = md("# T\r\n\r\n## A\r\n\r\nx\r\n");
    expect(d.sections[0].title).toBe("A");
  });
});

describe("parseDoc(text)", () => {
  it("見出しなし・表紙のみ", () => {
    const d = parseDoc({ path: "LICENSE.txt", kind: "text", source: "MIT License\n# not heading" });
    expect(d.headings).toEqual([]);
    expect(d.sections).toEqual([]);
    expect(d.totalTokenCount).toBe(d.coverTokenCount);
  });
});

describe("estimateTokens", () => {
  it("ASCIIは4文字≒1、日本語は1文字≒1", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("あいう")).toBe(3);
    expect(estimateTokens("")).toBe(0);
  });
});
