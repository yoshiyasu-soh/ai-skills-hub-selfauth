import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarkdownContent from "./MarkdownContent";

// 外部画像を自動で読み込むと、閲覧しただけで閲覧者のIPアドレス等が画像の置き場所に送られるため、リンクとして表示する
describe("MarkdownContent の外部画像", () => {
  it("Markdown記法の外部画像は読み込まず、リンクとして表示する", () => {
    const html = renderToStaticMarkup(<MarkdownContent content="![構成図](https://example.com/a.png)" />);
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://example.com/a.png"');
    expect(html).toContain("構成図");
  });

  it("本文中の生HTMLの外部画像も読み込まない", () => {
    const html = renderToStaticMarkup(<MarkdownContent content={'<img src="https://example.com/b.png" alt="図B">'} />);
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://example.com/b.png"');
  });

  it("リンクの中の画像(バッジ等)は、リンクを入れ子にせず文字だけにする", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content="[![npm](https://img.example.com/badge.svg)](https://www.npmjs.com/package/x)" />,
    );
    expect(html).not.toContain("<img");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://www.npmjs.com/package/x"');
    expect(html).toContain("画像: npm");
  });
});
