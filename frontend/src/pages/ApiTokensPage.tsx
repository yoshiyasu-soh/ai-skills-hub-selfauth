import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { formatDateTime, isPastDateTime } from "../lib/formatDate";
import { useToast } from "../lib/ToastContext";
import type { ApiTokenSummary, NewApiToken } from "../lib/types";

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "無期限" },
  { value: "30", label: "30日" },
  { value: "90", label: "90日" },
  { value: "180", label: "180日" },
  { value: "365", label: "365日" },
];

export default function ApiTokensPage() {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<NewApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  function loadTokens() {
    setLoading(true);
    api.tokens
      .list()
      .then((res) => setTokens(res.tokens))
      .catch((err) => showToast(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = await api.tokens.create(label.trim() || undefined, expiresInDays ? Number(expiresInDays) : undefined);
      setNewToken(token);
      setCopied(false);
      setLabel("");
      setExpiresInDays("");
      loadTokens();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "発行に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!window.confirm("このトークンを失効させますか?このトークンを使っている接続は使えなくなります。")) return;
    try {
      await api.tokens.remove(id);
      showToast("トークンを失効しました");
      if (newToken?.id === id) setNewToken(null);
      loadTokens();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "失効に失敗しました");
    }
  }

  async function handleCopy() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境では何もしない(手動選択でコピーしてもらう)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-slate-900">MCP用アクセストークン</h1>
      <p className="mb-5 text-sm text-slate-500">
        Claude Code / Claude Desktop などのMCPクライアントからAI Skills Hubに接続する際の認証に使います。
        接続手順は{" "}
        <Link to="/guide/mcp" className="font-medium text-brand-600 hover:text-brand-700">
          MCP連携ガイド
        </Link>{" "}
        を参照してください。
      </p>

      {newToken && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            トークンを発行しました。この値は今しか表示されません。必ずコピーして安全な場所に保管してください。
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5">
            <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed text-slate-100">
              {newToken.token}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            有効期限: {newToken.expiresAt ? formatDateTime(newToken.expiresAt) : "無期限"}
          </p>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-2 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">ラベル(任意、例: Claude Code)</span>
          <input
            maxLength={100}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">有効期限</span>
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? "発行中..." : "新しいトークンを発行"}
        </button>
      </form>
      <p className="mb-6 text-xs text-slate-400">
        漏洩リスクを抑えるため、長期間使わない予定の接続には有効期限を設定することをおすすめします。
        期限切れのトークンはこの画面から確認・失効できます。
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">読み込み中...</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-slate-400">発行済みのトークンはありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => {
            const expired = isPastDateTime(t.expiresAt);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {t.label || "(ラベルなし)"}
                    {expired && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        期限切れ
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    発行日: {formatDateTime(t.createdAt)} / 最終利用: {formatDateTime(t.lastUsedAt)}
                  </p>
                  <p className="text-xs text-slate-400">
                    有効期限: {t.expiresAt ? formatDateTime(t.expiresAt) : "無期限"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(t.id)}
                  className="shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  失効する
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
