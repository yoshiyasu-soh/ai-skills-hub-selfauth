import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { ApiError, api } from "../lib/api";

/**
 * 確認メールのリンクから開く画面。メールを受け取った本人がここでパスワードと表示名を設定し、登録を完了する
 * (登録時にパスワードを受け付けると、第三者が未確認のアドレスへ再登録してパスワードを差し替えられるため)。
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.verifyEmail(token, password, displayName);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.message.startsWith("invalid_or_expired_token")) {
        setError("リンクが無効か、有効期限が切れています。もう一度登録をやり直してください。");
      } else {
        setError(err instanceof Error ? err.message : "登録に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center text-sm text-ink-secondary">
        リンクが正しくありません。
        <Link to="/register" className="ml-1 font-medium text-ink hover:underline">
          登録をやり直す
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center">
        <LogoMark className="mb-4 h-10 w-10" />
        <h1 className="mb-2 font-display text-lg font-bold text-ink">登録が完了しました</h1>
        <Link
          to="/login"
          className="mt-4 rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text hover:bg-cta-hover"
        >
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display text-xl font-bold text-ink">登録を完了する</h1>
        <p className="text-center text-sm text-ink-secondary">表示名とパスワードを設定してください。</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-secondary">表示名(投稿者名として表示されます)</span>
          <input
            type="text"
            required
            maxLength={100}
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text shadow-sm transition-colors hover:bg-cta-hover disabled:opacity-50"
        >
          {submitting ? "登録中..." : "登録を完了する"}
        </button>
      </form>
    </div>
  );
}
