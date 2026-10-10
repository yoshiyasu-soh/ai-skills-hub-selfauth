import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import TurnstileWidget, { useTurnstileSiteKey } from "../components/TurnstileWidget";
import { ApiError, api } from "../lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const turnstileSiteKey = useTurnstileSiteKey();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // トークンは1回しか使えないため、失敗後の再試行ではウィジェットを作り直す
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.register(email, turnstileToken ?? undefined);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.message.startsWith("domain_not_allowed")) {
        setError("このメールアドレスのドメインでは登録できません");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("このメールアドレスは既に登録されています");
      } else if (err instanceof ApiError && err.message.startsWith("bot_check_failed")) {
        setError("ボット対策の確認ができませんでした。もう一度お試しください。");
      } else {
        setError(err instanceof Error ? err.message : "登録に失敗しました");
      }
      setTurnstileToken(null);
      setTurnstileKey((k) => k + 1);
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
          {email} 宛にメールを送信しました。メール内のリンクを開き、パスワードと表示名を設定して登録を完了してください。
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
        <p className="text-xs text-ink-secondary">パスワードは、確認メールのリンクを開いた後に設定します。</p>
        {turnstileSiteKey && (
          <TurnstileWidget key={turnstileKey} siteKey={turnstileSiteKey} action="signup" onToken={setTurnstileToken} />
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting || turnstileSiteKey === undefined || (Boolean(turnstileSiteKey) && !turnstileToken)}
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
