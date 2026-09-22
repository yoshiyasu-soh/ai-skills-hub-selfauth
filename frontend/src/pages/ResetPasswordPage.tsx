import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { ApiError, api } from "../lib/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("リンクが無効か有効期限が切れています。もう一度お試しください。");
      } else {
        setError(err instanceof Error ? err.message : "再設定に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center text-sm text-ink-secondary">
        リンクが正しくありません。
        <Link to="/forgot-password" className="ml-1 font-medium text-ink hover:underline">
          再設定をやり直す
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center">
        <LogoMark className="mb-4 h-10 w-10" />
        <h1 className="mb-2 font-display text-lg font-bold text-ink">パスワードを再設定しました</h1>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-4 rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text hover:bg-cta-hover"
        >
          ログイン画面へ
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display text-xl font-bold text-ink">新しいパスワードを設定</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-secondary">新しいパスワード(8文字以上)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text shadow-sm transition-colors hover:bg-cta-hover disabled:opacity-50"
        >
          {submitting ? "設定中..." : "パスワードを再設定する"}
        </button>
      </form>
    </div>
  );
}
