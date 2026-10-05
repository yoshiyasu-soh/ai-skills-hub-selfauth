import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ModScan } from "../lib/types";

const LEVEL_META = {
  high: { label: "要注意", box: "border-danger/30 bg-danger-dim", text: "text-danger" },
  medium: { label: "注意", box: "border-external/30 bg-external-dim", text: "text-external" },
  low: { label: "低", box: "border-border bg-surface-2", text: "text-success" },
} as const;

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <code key={x} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
          {x}
        </code>
      ))}
    </div>
  );
}

/**
 * Modが使うイベントとmods API呼び出しを、投稿されたコードの静的スキャン結果として表示する。
 * Modはユーザー権限で動くコードなので、インストール前の判断材料として常に警告とともに出す。
 */
export default function ModScanPanel({ itemId }: { itemId: string }) {
  const [scan, setScan] = useState<ModScan | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScan(null);
    setError(false);
    api.items
      .modScan(itemId)
      .then((res) => !cancelled && setScan(res.scan))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const meta = LEVEL_META[scan?.level ?? "low"];

  return (
    <section className={`rounded-xl border p-4 shadow-card ${scan ? meta.box : "border-border bg-surface"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Modが行うこと</h2>
        {scan && (
          <span className={`rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold ${meta.text}`}>
            リスク: {meta.label}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-ink-secondary">
        Modはあなたの権限で動くコードで、サンドボックス化されません。ファイルの読み書き、プログラムの起動、ネットワーク通信、
        環境変数(APIキー等)の読み取りが可能です。信頼できる作者のものだけをインストールしてください。
      </p>

      {error && <p className="mt-3 text-sm text-danger">スキャン結果を取得できませんでした。</p>}
      {!scan && !error && <p className="mt-3 text-sm text-ink-secondary">コードを調べています...</p>}

      {scan && (
        <div className="mt-3 flex flex-col gap-3">
          {scan.findings.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {scan.findings.map((f) => (
                <li key={`${f.kind}-${f.name}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className={`shrink-0 text-[11px] font-semibold ${f.level === "high" ? "text-danger" : "text-external"}`}>
                    {f.level === "high" ? "[要注意]" : "[注意]"}
                  </span>
                  <code className="font-mono text-xs text-ink">{f.name}</code>
                  <span className="text-ink-secondary">{f.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-secondary">ファイル・プロセス・ネットワーク等に関わる呼び出しは見つかりませんでした。</p>
          )}

          {scan.hooks.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ink-secondary">処理するイベント</p>
              <Chips items={scan.hooks} />
            </div>
          )}
          {scan.calls.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-ink-secondary">呼び出すAPI</p>
              <Chips items={scan.calls.map((c) => `$.${c}`)} />
            </div>
          )}
          {(scan.envReads.length > 0 || scan.envWrites.length > 0) && (
            <div>
              <p className="mb-1 text-xs text-ink-secondary">環境変数</p>
              <Chips items={[...scan.envReads.map((n) => `読取 ${n}`), ...scan.envWrites.map((n) => `設定 ${n}`)]} />
            </div>
          )}

          <p className="text-xs leading-relaxed text-ink-muted">
            正規表現による簡易スキャン(ベストエフォート)です。安全性の保証ではありません。インストール前に
            「ドキュメント」タブでコードを確認するか、手元で <code className="font-mono">claude plugin validate</code> を実行して
            hooks / calls を確認してください。
          </p>
        </div>
      )}
    </section>
  );
}
