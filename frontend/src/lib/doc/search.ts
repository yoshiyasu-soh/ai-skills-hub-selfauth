import type { ParsedDoc, SearchHit } from "./types";

const SNIPPET_RADIUS = 40;

/** 全角半角・大文字小文字を区別しない形に畳み込む。畳み込み後の各位置が元文字列のどこに対応するかも返す */
function fold(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = ch.normalize("NFKC").toLowerCase();
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(i);
  return { folded, map };
}

/** text中でqueryに一致する範囲(元文字列のインデックス)を返す。正規表現は使わないため特殊文字も安全 */
export function findRanges(text: string, query: string): [number, number][] {
  const q = fold(query.trim()).folded;
  if (!q) return [];
  const { folded, map } = fold(text);
  const ranges: [number, number][] = [];
  let from = 0;
  for (;;) {
    const at = folded.indexOf(q, from);
    if (at === -1) break;
    ranges.push([map[at], map[at + q.length]]);
    from = at + q.length;
  }
  return ranges;
}

function makeSnippet(line: string, ranges: [number, number][]): { snippet: string; ranges: [number, number][] } {
  const start = Math.max(0, ranges[0][0] - SNIPPET_RADIUS);
  const end = Math.min(line.length, ranges[0][1] + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < line.length ? "…" : "";
  const shift = prefix.length - start;
  return {
    snippet: prefix + line.slice(start, end) + suffix,
    ranges: ranges.filter(([a, b]) => a >= start && b <= end).map(([a, b]) => [a + shift, b + shift]),
  };
}

/** 見出し一致を先、本文一致(行単位)を後に並べて返す。選択中ファイルのみが対象 */
export function searchDoc(doc: ParsedDoc, query: string): SearchHit[] {
  if (!query.trim()) return [];

  const lines = doc.file.source.replace(/\r\n?/g, "\n").split("\n");

  // 見出しの無いテキストファイルは、行単位の本文一致のみ(セクションIDは "file" 固定)
  if (doc.file.kind === "text") {
    const hits: SearchHit[] = [];
    lines.forEach((text, i) => {
      const ranges = findRanges(text, query);
      if (ranges.length === 0) return;
      const { snippet, ranges: r } = makeSnippet(text, ranges);
      hits.push({ sectionId: "file", kind: "body", snippet, ranges: r, line: i + 1 });
    });
    return hits;
  }
  if (doc.sections.length === 0) return [];
  const headingHits: SearchHit[] = [];
  const bodyHits: SearchHit[] = [];

  for (const section of doc.sections) {
    if (section.id === "intro") continue;
    const ranges = findRanges(section.title, query);
    if (ranges.length > 0) {
      headingHits.push({ sectionId: section.id, kind: "heading", snippet: section.title, ranges, line: section.startLine });
    }
  }

  let current = -1;
  for (let i = 0; i < lines.length; i++) {
    while (current + 1 < doc.sections.length && doc.sections[current + 1].startLine <= i + 1) current++;
    if (current === -1) continue;
    const section = doc.sections[current];
    if (section.id !== "intro" && section.startLine === i + 1) continue; // 見出し行は見出し一致として扱い済み
    const ranges = findRanges(lines[i], query);
    if (ranges.length === 0) continue;
    const { snippet, ranges: r } = makeSnippet(lines[i], ranges);
    bodyHits.push({ sectionId: section.id, kind: "body", snippet, ranges: r, line: i + 1 });
  }

  return [...headingHits, ...bodyHits];
}
