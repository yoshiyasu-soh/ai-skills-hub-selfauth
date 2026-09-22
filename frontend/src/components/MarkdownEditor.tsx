import { useState } from "react";
import MarkdownContent from "./MarkdownContent";

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  textareaClassName: string;
}

/**
 * GitHubのIssue本文入力のような「編集/プレビュー」切り替え式のMarkdownエディタ。
 * リアルタイムプレビューではなく、タブ切り替え時にその時点の内容を描画する。
 */
export default function MarkdownEditor({ value, onChange, rows = 6, placeholder, textareaClassName }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const minHeight = `${rows * 1.6 + 1}rem`;

  return (
    <div>
      <div className="mb-1.5 inline-flex overflow-hidden rounded-md border border-border text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`px-3 py-1 transition-colors ${
            mode === "edit" ? "bg-active text-active-text" : "bg-surface text-ink-secondary hover:bg-surface-2"
          }`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={`px-3 py-1 transition-colors ${
            mode === "preview" ? "bg-active text-active-text" : "bg-surface text-ink-secondary hover:bg-surface-2"
          }`}
        >
          プレビュー
        </button>
      </div>

      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={textareaClassName}
        />
      ) : (
        <div className="rounded-md border border-border bg-surface px-3 py-2" style={{ minHeight }}>
          {value.trim() ? (
            <MarkdownContent content={value} />
          ) : (
            <p className="text-sm text-ink-muted">プレビューする内容がありません</p>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-ink-muted">Markdown記法に対応しています(見出し・リスト・コード・表など)</p>
    </div>
  );
}
