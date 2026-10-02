import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseDoc } from "../../lib/doc/parseDoc";
import type { DocFile, SearchHit } from "../../lib/doc/types";
import { FileIcon } from "../icons";
import CodePane from "./CodePane";
import CopyButton from "./CopyButton";
import FilePanel from "./FilePanel";
import PreviewPane, { scrollToId } from "./PreviewPane";
import SearchPalette from "./SearchPalette";
import SlidesPane from "./SlidesPane";
import ViewerToolbar, { type ViewerTab } from "./ViewerToolbar";

interface Props {
  files: DocFile[];
  folderName: string;
}

const COLLAPSED_HEIGHT = 560;

export default function DocViewer({ files, folderName }: Props) {
  // パースは一度だけ行い、全タブで共有する(タブ間で数値がずれない)
  const parsed = useMemo(() => new Map(files.map((f) => [f.path, parseDoc(f)])), [files]);
  const mainPath = files[0].path;

  const [tab, setTab] = useState<ViewerTab>("preview");
  const [path, setPath] = useState(mainPath);
  const [slide, setSlide] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingJump, setPendingJump] = useState<SearchHit | null>(null);
  const [overflowing, setOverflowing] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);

  const doc = parsed.get(path) ?? parsed.get(mainPath)!;
  const multiFile = files.length > 1;

  function selectFile(next: string) {
    setPath(next);
    setSlide(0); // C-7: ファイルを切り替えたらスライドとスクロールは先頭へ。タブと検索語は維持する
    contentRef.current?.scrollTo({ top: 0 });
  }

  // 本文が高さ上限に収まるなら折りたたまない。折りたたみ中も実寸を測れるよう、scrollHeightで判定する
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 8);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, path, expanded]);

  // 検索結果の確定 → 表示中のタブに応じてジャンプ。描画後に実行するため pendingJump を経由する
  function jumpTo(hit: SearchHit) {
    setSearchOpen(false);
    if (tab === "slides") {
      const i = doc.sections.findIndex((s) => s.id === hit.sectionId);
      setSlide(i === -1 ? 0 : i + 1);
      return;
    }
    setExpanded(true);
    setPendingJump(hit);
  }

  useEffect(() => {
    if (!pendingJump) return;
    const hit = pendingJump;
    setPendingJump(null);
    requestAnimationFrame(() => {
      if (tab === "code") {
        const el = codeRef.current?.querySelector<HTMLElement>(`#L${hit.line}`);
        el?.scrollIntoView({ block: "center" });
      } else if (hit.sectionId !== "intro" && hit.sectionId !== "file") {
        scrollToId(contentRef.current, hit.sectionId);
      } else {
        contentRef.current?.scrollIntoView({ block: "start" });
      }
    });
  }, [pendingJump, tab]);

  // 検索の呼び出し口: Ctrl/Cmd+F(ビューア内にフォーカスがあるときだけブラウザ標準を上書きする)
  function onRootKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setSearchOpen(true);
    }
  }

  const copyFailed = useCallback(() => {
    // 手動コピーを促すため、Codeタブで原文を選択状態にする
    setTab("code");
    setExpanded(true);
    requestAnimationFrame(() => {
      const el = codeRef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, []);

  const highlight = searchOpen ? query : "";
  const showFolder = multiFile && (tab === "code" || tab === "preview");
  const collapsible = tab !== "slides" && !expanded && overflowing;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      className="relative border border-border bg-surface focus:outline-none"
    >
      <ViewerToolbar
        tab={tab}
        onTabChange={setTab}
        onOpenSearch={() => setSearchOpen(true)}
        actions={<CopyButton text={doc.file.source} onFailure={copyFailed} />}
      />
      {searchOpen && (
        <SearchPalette
          doc={doc}
          initialQuery={query}
          onQueryChange={setQuery}
          onSelect={jumpTo}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {multiFile && showFolder && !panelOpen && (
        <div className="border-b border-border px-2 py-1.5">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-ink-secondary hover:bg-surface-2 hover:text-ink"
          >
            <FileIcon className="h-3.5 w-3.5" />
            Browse files ({files.length})
            <span className="ml-1 font-mono text-ink">{doc.file.path}</span>
          </button>
        </div>
      )}

      <div id="doc-viewer-panel" role="tabpanel" aria-labelledby={`doc-tab-${tab}`} className="relative flex min-w-0">
        {showFolder && panelOpen && (
          <FilePanel
            folderName={folderName}
            paths={files.map((f) => f.path)}
            selected={doc.file.path}
            onSelect={selectFile}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <div className="relative min-w-0 flex-1">
          <div
            ref={contentRef}
            style={collapsible ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
            className={collapsible ? "overflow-hidden" : ""}
          >
            {tab === "code" && <CodePane ref={codeRef} source={doc.file.source} query={highlight} />}
            {tab === "preview" && <PreviewPane doc={doc} query={highlight} onRequestExpand={() => setExpanded(true)} />}
            {tab === "slides" && (
              <SlidesPane
                doc={doc}
                index={Math.min(slide, doc.sections.length)}
                onIndexChange={setSlide}
                query={highlight}
                keysEnabled={!searchOpen}
                onShowFull={() => {
                  setTab("preview");
                  setExpanded(true);
                }}
              />
            )}
          </div>
          {collapsible && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-surface to-transparent pb-3">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="pointer-events-auto border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
              >
                Show full document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
