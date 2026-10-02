export type DocFile = {
  path: string;
  kind: "markdown" | "text";
  source: string;
};

export type Heading = { id: string; level: 1 | 2 | 3; text: string; line: number };

export type Section = {
  id: string;
  title: string;
  level: number;
  /** 原文での見出し行(1始まり)。Codeタブのジャンプ用。導入は本文の開始行 */
  startLine: number;
  /** スライド本文(Markdown)。見出し行は含まない */
  body: string;
  /** スライドのトークン推定値(見出し行を含む) */
  tokenCount: number;
};

export type ParsedDoc = {
  file: DocFile;
  frontmatter: Record<string, string>;
  headings: Heading[];
  /** Slides = [表紙, ...sections] */
  sections: Section[];
  /** 表紙(フロントマター)のトークン推定値 */
  coverTokenCount: number;
  /** 表紙 + 全セクションの合計 */
  totalTokenCount: number;
  /** フロントマターを空行に置き換えた本文。行番号を原文と揃えたままレンダリングするために使う */
  renderSource: string;
};

export type SearchHit = {
  sectionId: string;
  kind: "heading" | "body";
  snippet: string;
  ranges: [number, number][];
  line: number;
};
