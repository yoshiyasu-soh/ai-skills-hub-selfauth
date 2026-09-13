import { ChevronRightIcon } from "./icons";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const SIBLING_COUNT = 1;

type PageEntry = number | "ellipsis-start" | "ellipsis-end";

function buildPageEntries(page: number, totalPages: number): PageEntry[] {
  const left = Math.max(2, page - SIBLING_COUNT);
  const right = Math.min(totalPages - 1, page + SIBLING_COUNT);

  const entries: PageEntry[] = [1];
  if (left > 2) entries.push("ellipsis-start");
  for (let i = left; i <= right; i++) entries.push(i);
  if (right < totalPages - 1) entries.push("ellipsis-end");
  if (totalPages > 1) entries.push(totalPages);
  return entries;
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const entries = buildPageEntries(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 pt-2 text-sm" aria-label="ページ送り">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        aria-label="前のページ"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon className="h-4 w-4 rotate-180" />
      </button>

      {entries.map((entry, i) =>
        entry === "ellipsis-start" || entry === "ellipsis-end" ? (
          <span key={entry + i} className="flex h-8 w-8 items-center justify-center text-slate-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium transition-colors ${
              entry === page ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        aria-label="次のページ"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </nav>
  );
}
