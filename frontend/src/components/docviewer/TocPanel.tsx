import type { Heading } from "../../lib/doc/types";

interface Props {
  headings: Heading[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** 「On this page」。H1〜H2(設定でH3も可)を一覧にし、現在位置を左線+太字で示す */
export default function TocPanel({ headings, activeId, onSelect }: Props) {
  return (
    <nav aria-label="On this page" className="max-h-[60vh] overflow-y-auto">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">On this page</p>
      <ul>
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                title={h.text}
                aria-current={active ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(h.id);
                }}
                className={`block truncate border-l-2 py-1 text-xs ${h.level === 1 ? "pl-3" : "pl-6"} ${
                  active ? "border-ink font-semibold text-ink" : "border-border text-ink-secondary hover:text-ink"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
