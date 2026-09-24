import { useState } from "react";
import type { Tag } from "../lib/types";

interface Props {
  tags: Tag[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export default function TagFilterBar({ tags, selected, onChange }: Props) {
  const [showAll, setShowAll] = useState(false);

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter((v) => v !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (tags.length === 0) return null;

  // 投稿が0件のタグは、選択済みでない限り初期状態では折りたたみ、認知負荷を下げる
  const hiddenCount = tags.filter((tag) => tag.item_count === 0 && !selected.includes(tag.id)).length;
  const visibleTags = showAll
    ? tags
    : tags.filter((tag) => tag.item_count !== 0 || selected.includes(tag.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleTags.map((tag) => {
        const active = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`rounded-full border px-3 py-1 font-mono text-xs font-medium transition ${
              active
                ? "border-active bg-active text-active-text"
                : "border-border bg-surface-2 text-ink-secondary hover:border-border-hover hover:bg-surface"
            }`}
          >
            #{tag.label}
            {tag.item_count !== undefined && <span className="ml-1 opacity-70">({tag.item_count})</span>}
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="rounded-full px-3 py-1 text-xs text-ink-muted hover:text-ink-secondary"
        >
          {showAll ? "0件のタグを隠す" : `他${hiddenCount}件のタグを表示`}
        </button>
      )}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-full px-3 py-1 text-xs text-ink-muted underline hover:text-ink-secondary"
        >
          タグ選択をクリア
        </button>
      )}
    </div>
  );
}
