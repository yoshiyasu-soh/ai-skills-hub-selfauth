import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { ApiError, api } from "../lib/api";
import { useUser } from "../lib/UserContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.login(email, password);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("メールアドレスの確認が完了していません。届いたメール内のリンクをご確認ください。");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("メールアドレスまたはパスワードが違います");
      } else {
        setError(err instanceof Error ? err.message : "ログインに失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display text-xl font-bold text-ink">AI Skills Hub にログイン</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-secondary">メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-secondary">パスワード</span>
          <input
            type="password"
            required
            autoComplete="current-password"
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
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-ink-secondary">
        <Link to="/forgot-password" className="hover:text-ink hover:underline">
          パスワードをお忘れですか?
        </Link>
        <Link to="/register" className="hover:text-ink hover:underline">
          新規登録
        </Link>
      </div>
    </div>
  );
}
