import { Link, useLocation } from "react-router-dom";
import { formatCompactNumber } from "../lib/formatNumber";
import type { Item } from "../lib/types";
import { BoxIcon, DownloadIcon, ExternalLinkIcon, SparkleIcon, StarIcon } from "./icons";

interface Props {
  item: Item;
  onToggleFavorite?: (item: Item) => void;
  rank?: number;
}

const TYPE_META = {
  skill: { label: "Skill", accentBg: "bg-skill", accentText: "text-skill", Icon: BoxIcon },
  prompt: { label: "Prompt", accentBg: "bg-prompt", accentText: "text-prompt", Icon: SparkleIcon },
  external: { label: "OSS紹介", accentBg: "bg-amber-500", accentText: "text-amber-600", Icon: ExternalLinkIcon },
} as const;

export default function ItemCard({ item, onToggleFavorite, rank }: Props) {
  const { label, accentBg, accentText, Icon } = TYPE_META[item.type];
  const location = useLocation();
  // 一覧側の絞り込み・ソート・ページ(現在のURL)を渡しておき、詳細ページの
  // 「一覧に戻る」がここへ戻れるようにする。
  const backState = { from: `${location.pathname}${location.search}` };

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover">
      {/* カード全体を1枚のリンクとして扱う(下の各インタラクティブ要素は relative+z-10 で手前に出して個別にクリックできるようにしている) */}
      <Link
        to={`/items/${item.id}`}
        state={backState}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={item.title}
      />

      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {rank !== undefined && <span className="text-sm font-bold tabular-nums text-slate-400">#{rank}</span>}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${accentBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${accentText}`}>{label}</span>
            {item.type === "external" ? (
              item.stars !== null && (
                <span className="flex items-center gap-0.5 font-mono text-[11px] text-slate-400">
                  <StarIcon filled className="h-2.5 w-2.5 text-amber-400" />
                  {formatCompactNumber(item.stars)}
                </span>
              )
            ) : (
              <span className="font-mono text-[11px] text-slate-400">v{item.version}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite?.(item)}
          className="relative z-10 flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-slate-400 hover:bg-amber-50 hover:text-amber-500"
          aria-label="お気に入り切り替え"
        >
          <StarIcon filled={item.isFavorited} className={`h-4 w-4 ${item.isFavorited ? "text-amber-400" : ""}`} />
          <span className="tabular-nums">{item.favoriteCount}</span>
        </button>
      </div>

      <p className="mb-1 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
        {item.title}
      </p>
      <p className="mb-3 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">
        {item.summary || "説明はまだありません"}
      </p>

      {item.hasUpdate && (
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
          更新あり
        </span>
      )}

      {item.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              #{tag.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
        <Link
          to={`/users/${encodeURIComponent(item.authorEmail)}`}
          className="relative z-10 flex items-center gap-1.5 hover:text-slate-600 hover:underline"
        >
          <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-500">
            {item.authorName.slice(0, 1)}
          </span>
          {item.authorName}
        </Link>
        <span className="flex items-center gap-1 tabular-nums">
          <DownloadIcon className="h-3.5 w-3.5" />
          {item.periodCount !== undefined ? `${item.periodCount} users (期間内)` : `${item.usageCount} users`}
        </span>
      </div>
    </div>
  );
}
