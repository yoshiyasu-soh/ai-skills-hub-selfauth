import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { ApiError, api } from "../lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.register(email, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("このメールアドレスのドメインでは登録できません");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("このメールアドレスは既に登録されています");
      } else {
        setError(err instanceof Error ? err.message : "登録に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center">
        <LogoMark className="mb-4 h-10 w-10" />
        <h1 className="mb-2 font-display text-lg font-bold text-ink">確認メールを送信しました</h1>
        <p className="text-sm text-ink-secondary">
          {email} 宛にメールを送信しました。メール内のリンクから登録を完了してください。
        </p>
        <Link to="/login" className="mt-6 text-sm font-medium text-ink hover:underline">
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display text-xl font-bold text-ink">AI Skills Hub に登録</h1>
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
          <span className="font-medium text-ink-secondary">パスワード(8文字以上)</span>
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
          {submitting ? "登録中..." : "登録する"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-secondary">
        すでにアカウントをお持ちですか?{" "}
        <Link to="/login" className="font-medium text-ink hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
