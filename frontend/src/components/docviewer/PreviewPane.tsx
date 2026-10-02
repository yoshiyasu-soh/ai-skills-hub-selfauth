import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedDoc } from "../../lib/doc/types";
import MarkdownContent from "../MarkdownContent";
import TocPanel from "./TocPanel";
import { useDomHighlight } from "./useDomHighlight";

interface Props {
  doc: ParsedDoc;
  query: string;
  /** 目次クリック時などに、折りたたみを解除してもらうためのコールバック */
  onRequestExpand: () => void;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 見出しへスクロールし、フォーカスを移す(キーボード利用者向け) */
export function scrollToId(root: HTMLElement | null, id: string) {
  const el = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

export default function PreviewPane({ doc, query, onRequestExpand }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const headingIds = useMemo(() => Object.fromEntries(doc.headings.map((h) => [h.line, h.id])), [doc]);
  // 目次はH1〜H2(P-2)。H3は本文側にだけidを持つ
  const tocHeadings = useMemo(() => doc.headings.filter((h) => h.level <= 2), [doc]);

  useDomHighlight(bodyRef, query, [doc]);

  // 現在位置の追従。上端付近に入った見出しのうち最も後ろのものを現在位置とする
  useEffect(() => {
    setActiveId(tocHeadings[0]?.id ?? null);
    const root = bodyRef.current;
    if (!root || tocHeadings.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const order = tocHeadings.map((h) => h.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const current = order.find((id) => visible.has(id));
        if (current) setActiveId(current);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const id of order) {
      const el = root.querySelector(`#${CSS.escape(id)}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [tocHeadings, doc]);

  if (doc.file.kind === "text") {
    return (
      <pre className="m-0 whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-ink">{doc.file.source}</pre>
    );
  }

  return (
    <div className="flex min-w-0 gap-6 p-4 lg:p-6">
      <div ref={bodyRef} className="min-w-0 flex-1">
        <MarkdownContent content={doc.renderSource} headingIds={headingIds} />
      </div>
      {tocHeadings.length > 0 && (
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-4">
            <TocPanel
              headings={tocHeadings}
              activeId={activeId}
              onSelect={(id) => {
                onRequestExpand();
                setActiveId(id);
                requestAnimationFrame(() => scrollToId(bodyRef.current, id));
              }}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
