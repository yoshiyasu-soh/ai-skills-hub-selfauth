import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LogoMark from "../components/LogoMark";
import { api } from "../lib/api";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.auth
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 py-12 text-center">
      <LogoMark className="mb-4 h-10 w-10" />
      {status === "loading" && <p className="text-sm text-ink-secondary">確認中...</p>}
      {status === "ok" && (
        <>
          <h1 className="mb-2 font-display text-lg font-bold text-ink">メールアドレスを確認しました</h1>
          <Link
            to="/login"
            className="mt-4 rounded-md bg-cta px-3.5 py-2 text-sm font-semibold text-cta-text hover:bg-cta-hover"
          >
            ログイン画面へ
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="mb-2 font-display text-lg font-bold text-ink">確認に失敗しました</h1>
          <p className="text-sm text-ink-secondary">リンクが無効か、有効期限が切れている可能性があります。</p>
        </>
      )}
    </div>
  );
}
