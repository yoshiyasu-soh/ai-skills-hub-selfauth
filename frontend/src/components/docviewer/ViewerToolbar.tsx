import type { KeyboardEvent, ReactNode } from "react";
import { SearchIcon } from "../icons";

export type ViewerTab = "code" | "preview" | "slides";

const TABS: { id: ViewerTab; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "preview", label: "Preview" },
  { id: "slides", label: "Slides" },
];

interface Props {
  tab: ViewerTab;
  onTabChange: (tab: ViewerTab) => void;
  onOpenSearch: () => void;
  /** 右端(Copyボタンなど) */
  actions: ReactNode;
}

export default function ViewerToolbar({ tab, onTabChange, onOpenSearch, actions }: Props) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // ARIAのタブパターン: ←/→でタブ間を移動し、移動先のタブを選択状態にする
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (at + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    e.stopPropagation(); // Slidesのキー操作と干渉させない
    onTabChange(TABS[next].id);
    requestAnimationFrame(() => document.getElementById(`doc-tab-${TABS[next].id}`)?.focus());
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
      <div role="tablist" aria-label="表示形式" className="flex" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`doc-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls="doc-viewer-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              tab === t.id ? "border-b-2 border-ink text-ink" : "border-b-2 border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenSearch}
        className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-ink-secondary hover:bg-surface-2 hover:text-ink"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        Search
        <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] text-ink-muted sm:inline">{isMac ? "⌘F" : "Ctrl+F"}</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </div>
  );
}
