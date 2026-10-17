import { useRef, useState, type DragEvent } from "react";

interface Props {
  /** input の accept と同じ形式(例: ".zip,.md")。ドロップ時の拡張子チェックにも使う */
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** 選択前に表示する補足(対応形式など) */
  hint?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * ドラッグ&ドロップ対応のファイル選択欄。
 * ダークモードでも枠線とアイコンで「ここに置く/押す場所」だと分かるよう、太い破線枠と広い領域にしている。
 */
export default function FileDropzone({ accept, file, onFileChange, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const extensions = accept.split(",").map((e) => e.trim().toLowerCase());

  function accepts(f: File): boolean {
    const name = f.name.toLowerCase();
    return extensions.some((ext) => name.endsWith(ext));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!accepts(f)) {
      setRejected(`${extensions.join(" / ")} のファイルを選んでください`);
      return;
    }
    setRejected(null);
    onFileChange(f);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
          dragging
            ? "border-signal bg-surface-2 text-ink"
            : file
              ? "border-success bg-surface-2 text-ink"
              : "border-ink-muted bg-surface-2 text-ink hover:border-signal"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8 text-ink" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" />
        </svg>
        {file ? (
          <>
            <p className="break-all font-mono text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-ink-secondary">{formatSize(file.size)} ・ クリックまたはドロップで差し替え</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">ここにファイルをドラッグ&ドロップ</p>
            <p className="text-xs text-ink-secondary">
              または <span className="rounded-md border border-ink-muted px-2 py-0.5 font-medium text-ink">ファイルを選択</span>
              {hint ? ` ・ ${hint}` : ` ・ ${extensions.join(" / ")}`}
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          setRejected(null);
          onFileChange(e.target.files?.[0] ?? null);
        }}
      />
      {rejected && <p className="mt-1.5 text-xs text-danger">{rejected}</p>}
    </div>
  );
}
