import { forwardRef, useMemo } from "react";
import { findRanges } from "../../lib/doc/search";
import Highlight from "./Highlight";

interface Props {
  source: string;
  query: string;
}

/** 原文をそのまま(フロントマター含む)等幅・折り返しありで表示する。行ごとにid(L<行番号>)を持ち、検索のジャンプ先になる */
const CodePane = forwardRef<HTMLPreElement, Props>(function CodePane({ source, query }, ref) {
  const lines = useMemo(() => source.replace(/\r\n?/g, "\n").split("\n"), [source]);
  const width = String(lines.length).length;

  return (
    <pre
      ref={ref}
      tabIndex={0}
      aria-label="ソース表示"
      className="m-0 overflow-x-hidden whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal-ring"
    >
      {lines.map((text, i) => (
        <div key={i} id={`L${i + 1}`} className="flex scroll-mt-4">
          <span aria-hidden className="mr-4 shrink-0 select-none text-right text-ink-muted" style={{ minWidth: `${width}ch` }}>
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <Highlight text={text} ranges={query ? findRanges(text, query) : []} />
            {text === "" && "​"}
          </span>
        </div>
      ))}
    </pre>
  );
});

export default CodePane;
