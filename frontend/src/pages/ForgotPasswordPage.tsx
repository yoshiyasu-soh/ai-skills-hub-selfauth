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
        <h1 className="text-xl font-bold text-slate-900">パスワード再設定</h1>
      </div>
      {done ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-card">
          登録されている場合、パスワード再設定メールを送信しました。メールをご確認ください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">登録済みのメールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "送信中..." : "再設定メールを送る"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  );
}
