import { useEffect, type RefObject } from "react";
import { findRanges } from "../../lib/doc/search";

type HighlightApi = { highlights?: Map<string, unknown> };

/**
 * コンテナ内のテキストノードから検索語に一致する範囲を CSS Custom Highlight API で強調する。
 * DOM自体は書き換えない(ReactMarkdownが管理するDOMと衝突しない)。非対応ブラウザでは何もしない。
 * deps が変わる(本文の切替)たびに再計算する。
 */
export function useDomHighlight(ref: RefObject<HTMLElement>, query: string, deps: unknown[]) {
  useEffect(() => {
    const registry = (CSS as unknown as HighlightApi).highlights;
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!registry || !HighlightCtor) return;

    registry.delete("doc-search");
    const root = ref.current;
    if (!root || !query.trim()) return;

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? "";
      for (const [start, end] of findRanges(text, query)) {
        const range = new Range();
        range.setStart(node, start);
        range.setEnd(node, end);
        ranges.push(range);
      }
    }
    if (ranges.length > 0) registry.set("doc-search", new HighlightCtor(...ranges));
    return () => {
      registry.delete("doc-search");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ...deps]);
}
