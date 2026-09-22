import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.auth.requestPasswordReset(email);
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display text-xl font-bold text-ink">パスワード再設定</h1>
      </div>
      {done ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-secondary shadow-card">
          登録されている場合、パスワード再設定メールを送信しました。メールをご確認ください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-secondary">登録済みのメールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text shadow-sm transition-colors hover:bg-cta-hover disabled:opacity-50"
          >
            {submitting ? "送信中..." : "再設定メールを送る"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-ink-secondary">
        <Link to="/login" className="font-medium text-ink hover:underline">
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  );
}
