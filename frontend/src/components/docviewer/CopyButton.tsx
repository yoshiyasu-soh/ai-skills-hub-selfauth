import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "../icons";

type Status = "idle" | "copied" | "failed";

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

interface Props {
  text: string;
  /** 失敗時に呼ばれる。呼び出し側で原文を選択状態にして手動コピーを促す */
  onFailure?: () => void;
}

export default function CopyButton({ text, onFailure }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }
    // 連打時は前のタイマーを捨てて、最後の操作から数え直す
    window.clearTimeout(timer.current);
    setStatus(ok ? "copied" : "failed");
    if (!ok) onFailure?.();
    timer.current = window.setTimeout(() => setStatus("idle"), ok ? 1800 : 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink"
      >
        {status === "copied" ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        {status === "copied" ? "Copied" : "Copy"}
      </button>
      <span role="status" aria-live="polite" className={status === "failed" ? "text-xs text-danger" : "sr-only"}>
        {status === "copied" ? "コピーしました" : status === "failed" ? "コピーできませんでした。選択した原文を手動でコピーしてください" : ""}
      </span>
    </>
  );
}
