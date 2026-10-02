import { estimateTokens } from "./tokens";
import type { DocFile, Heading, ParsedDoc, Section } from "./types";

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;

function parseFrontmatter(lines: string[]): { data: Record<string, string>; endLine: number } {
  if (lines[0]?.trim() !== "---") return { data: {}, endLine: 0 };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { data: {}, endLine: 0 };

  const data: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      const parts: string[] = [];
      while (i + 1 < end && /^[ \t]+\S|^\s*$/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.filter(Boolean).join(" ");
    } else {
      value = value.replace(/^["'](.*)["']$/, "$1");
    }
    data[key] = value;
  }
  return { data, endLine: end + 1 };
}

function plainHeadingText(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** コードフェンス内を除いた見出し行を列挙する(indexは0始まりの行番号) */
function scanHeadings(lines: string[], from: number): { index: number; level: number; text: string }[] {
  const found: { index: number; level: number; text: string }[] = [];
  let fence: string | null = null;
  for (let i = from; i < lines.length; i++) {
    const f = lines[i].match(FENCE);
    if (f) {
      if (fence === null) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = lines[i].match(HEADING);
    if (h) found.push({ index: i, level: h[1].length, text: plainHeadingText(h[2]) });
  }
  return found;
}

export function headingId(index: number): string {
  return `section-${index + 1}`;
}

export function parseDoc(file: DocFile): ParsedDoc {
  const normalized = file.source.replace(/\r\n?/g, "\n");

  if (file.kind === "text") {
    const tokens = estimateTokens(normalized);
    return {
      file,
      frontmatter: {},
      headings: [],
      sections: [],
      coverTokenCount: tokens,
      totalTokenCount: tokens,
      renderSource: normalized,
    };
  }

  const lines = normalized.split("\n");
  const { data: frontmatter, endLine: fmEnd } = parseFrontmatter(lines);
  const all = scanHeadings(lines, fmEnd);

  const headings: Heading[] = [];
  all.forEach((h) => {
    if (h.level <= 3) {
      headings.push({ id: headingId(headings.length), level: h.level as 1 | 2 | 3, text: h.text, line: h.index + 1 });
    }
  });

  const h2s = all.filter((h) => h.level === 2);
  const introEnd = h2s.length > 0 ? h2s[0].index : lines.length;

  // 導入: 最初のH1見出し行(あれば)を除いた、最初のH2直前までの本文
  const introLines = lines.slice(fmEnd, introEnd);
  const h1Index = all.find((h) => h.level === 1 && h.index >= fmEnd && h.index < introEnd)?.index;
  const introBody = introLines.filter((_, i) => fmEnd + i !== h1Index).join("\n").trim();

  let coverTokenCount = estimateTokens(lines.slice(0, fmEnd).join("\n"));
  const sections: Section[] = [];

  if (introBody) {
    sections.push({
      id: "intro",
      title: "Introduction",
      level: 1,
      startLine: fmEnd + 1,
      body: introBody,
      tokenCount: estimateTokens(introLines.join("\n")),
    });
  } else {
    // 導入スライドを作らない場合も、H1行のトークンを表紙に寄せて合計を一致させる
    coverTokenCount += estimateTokens(introLines.join("\n"));
  }

  h2s.forEach((h, n) => {
    const end = n + 1 < h2s.length ? h2s[n + 1].index : lines.length;
    const heading = headings.find((x) => x.line === h.index + 1)!;
    sections.push({
      id: heading.id,
      title: h.text,
      level: 2,
      startLine: h.index + 1,
      body: lines.slice(h.index + 1, end).join("\n").trim(),
      tokenCount: estimateTokens(lines.slice(h.index, end).join("\n")),
    });
  });

  const totalTokenCount = coverTokenCount + sections.reduce((sum, s) => sum + s.tokenCount, 0);
  const renderSource = [...Array<string>(fmEnd).fill(""), ...lines.slice(fmEnd)].join("\n");

  return { file, frontmatter, headings, sections, coverTokenCount, totalTokenCount, renderSource };
}
