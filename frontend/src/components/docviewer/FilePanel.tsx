import { useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, FileIcon, SearchIcon } from "../icons";

interface Props {
  folderName: string;
  paths: string[];
  selected: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function FilePanel({ folderName, paths, selected, onSelect, onClose }: Props) {
  const [filter, setFilter] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? paths.filter((p) => p.toLowerCase().includes(q)) : paths;
  }, [paths, filter]);

  function moveFocus(delta: number) {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[Math.min(buttons.length - 1, Math.max(0, at + delta))]?.focus();
  }

  return (
    <div className="flex w-full flex-col border-border bg-surface max-sm:absolute max-sm:inset-0 max-sm:z-10 sm:w-60 sm:shrink-0 sm:border-r">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="ファイル一覧を閉じる"
          className="rounded p-1 text-ink-secondary hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-ink" title={folderName}>
          {folderName}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-secondary" aria-label={`${paths.length}ファイル`}>
          {paths.length}
        </span>
      </div>
      <label className="relative block border-b border-border">
        <span className="sr-only">ファイルを絞り込む</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              listRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
            }
          }}
          placeholder="Filter files..."
          className="w-full bg-transparent py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal-ring"
        />
      </label>
      {visible.length === 0 ? (
        <p className="px-3 py-4 text-xs text-ink-secondary">該当なし</p>
      ) : (
        <ul
          ref={listRef}
          className="max-h-72 overflow-y-auto py-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveFocus(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveFocus(-1);
            }
          }}
        >
          {visible.map((path) => {
            const active = path === selected;
            return (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => onSelect(path)}
                  aria-current={active ? "true" : undefined}
                  title={path}
                  className={`flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left font-mono text-xs ${
                    active
                      ? "border-ink bg-surface-2 font-semibold text-ink"
                      : "border-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <FileIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{path}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
