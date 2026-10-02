import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchDoc } from "../../lib/doc/search";
import type { ParsedDoc, SearchHit } from "../../lib/doc/types";
import { CloseIcon, SearchIcon } from "../icons";
import Highlight from "./Highlight";

const MAX_RESULTS = 50;

interface Props {
  doc: ParsedDoc;
  initialQuery: string;
  onQueryChange: (q: string) => void;
  onSelect: (hit: SearchHit) => void;
  onClose: () => void;
}

export default function SearchPalette({ doc, initialQuery, onQueryChange, onSelect, onClose }: Props) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // 入力のデバウンス(120ms)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(input);
      onQueryChange(input);
      setActive(0);
    }, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // 外側クリックで閉じる
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const hits = useMemo(() => searchDoc(doc, query), [doc, query]);
  const shown = hits.slice(0, MAX_RESULTS);
  const hasQuery = query.trim() !== "";

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" && shown.length > 0) {
      e.preventDefault();
      setActive((a) => (a + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length > 0) {
      e.preventDefault();
      setActive((a) => (a - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      onSelect(shown[active]);
    }
  }

  const titleOf = (id: string) => doc.sections.find((s) => s.id === id)?.title ?? doc.file.path;

  return (
    <div ref={rootRef} className="absolute inset-x-3 top-12 z-20 border border-border bg-surface shadow-card sm:left-auto sm:w-[28rem]">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={shown.length > 0 ? `${listId}-${active}` : undefined}
          aria-label="ドキュメント内検索"
          aria-autocomplete="list"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search..."
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        {hasQuery && (
          <span className="shrink-0 font-mono text-[11px] text-ink-secondary" aria-live="polite">
            {hits.length === 0 ? "該当なし" : `${hits.length} matches`}
          </span>
        )}
        <button type="button" onClick={onClose} aria-label="検索を閉じる" className="rounded p-1 text-ink-secondary hover:bg-surface-2 hover:text-ink">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <ul id={listId} role="listbox" aria-label="検索結果" className="max-h-72 overflow-y-auto">
        {shown.map((hit, i) => (
          <li
            key={`${hit.kind}-${hit.line}-${i}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(hit)}
            className={`cursor-pointer border-l-2 px-3 py-2 ${i === active ? "border-ink bg-surface-2" : "border-transparent"}`}
          >
            {hit.kind === "heading" ? (
              <p className="truncate text-sm font-semibold text-ink">
                <Highlight text={hit.snippet} ranges={hit.ranges} />
              </p>
            ) : (
              <>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{titleOf(hit.sectionId)}</p>
                <p className="truncate text-xs text-ink-secondary">
                  <Highlight text={hit.snippet} ranges={hit.ranges} />
                </p>
              </>
            )}
          </li>
        ))}
        {hits.length > MAX_RESULTS && <li className="px-3 py-2 text-xs text-ink-muted">他 {hits.length - MAX_RESULTS} 件</li>}
      </ul>
    </div>
  );
}
