import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatDate";
import { useToast } from "../lib/ToastContext";
import type { Item, ItemVersion } from "../lib/types";
import { CopyIcon, DownloadIcon } from "./icons";

interface Props {
  item: Item;
  onCountChange?: (count: number) => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function VersionHistorySection({ item, onCountChange }: Props) {
  const { showToast } = useToast();
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.items.versions
      .list(item.id)
      .then((res) => setVersions(res.versions))
      .catch(() => showToast("バージョン履歴の取得に失敗しました"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    onCountChange?.(versions.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length]);

  async function handleCopy(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      showToast("クリップボードにコピーしました");
    } catch {
      showToast("クリップボードへのコピーに失敗しました");
    }
  }

  if (loading) return <p className="text-sm text-ink-secondary">読み込み中...</p>;

  // 新しい順(現在 → 過去)に並べる
  const past = [...versions].reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-signal/30 bg-signal/10 p-3.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-active px-2 py-0.5 font-mono text-xs font-semibold text-active-text">
            v{item.version}
          </span>
          <span className="text-xs font-semibold text-ink font-display">現在のバージョン</span>
          <span className="text-xs text-ink-secondary">更新: {formatDateTime(item.updatedAt)}</span>
        </div>
        {item.type === "prompt" ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{item.body}</p>
        ) : (
          item.fileName && (
            <p className="text-sm text-ink-secondary">
              {item.fileName}
              <span className="ml-1.5 text-xs text-ink-muted">({formatBytes(item.fileSize)})</span>
            </p>
          )
        )}
      </div>

      {past.length === 0 ? (
        <p className="text-sm text-ink-secondary">まだ過去バージョンはありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {past.map((v) => (
            <li key={v.id} className="rounded-lg border border-border p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold text-ink-secondary">
                  v{v.version}
                </span>
                <span className="text-xs text-ink-secondary">置き換え: {formatDateTime(v.createdAt)}</span>
              </div>
              {item.type === "prompt" ? (
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{v.body}</p>
                  <button
                    type="button"
                    onClick={() => void handleCopy(v.body)}
                    aria-label="このバージョンの本文をコピー"
                    className="shrink-0 rounded-md border border-border p-1.5 text-ink-secondary hover:bg-surface-2"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                v.fileName && (
                  <a
                    href={api.items.versions.downloadUrl(item.id, v.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink decoration-signal decoration-2 underline-offset-2 hover:underline"
                  >
                    <DownloadIcon className="h-3.5 w-3.5" />
                    {v.fileName}
                    <span className="text-xs text-ink-muted">({formatBytes(v.fileSize)})</span>
                  </a>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
