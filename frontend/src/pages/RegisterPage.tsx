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
        <h1 className="mb-2 text-lg font-bold text-slate-900">確認メールを送信しました</h1>
        <p className="text-sm text-slate-500">
          {email} 宛にメールを送信しました。メール内のリンクから登録を完了してください。
        </p>
        <Link to="/login" className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700">
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="text-xl font-bold text-slate-900">AI Skills Hub に登録</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">パスワード(8文字以上)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "登録中..." : "登録する"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        すでにアカウントをお持ちですか?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          ログイン
        </Link>
      </p>
    </div>
  );
}
