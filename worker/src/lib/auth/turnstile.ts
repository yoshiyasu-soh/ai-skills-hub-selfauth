import type { Env } from "../../types";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** ウィジェットを置く画面ごとの action。別の画面で発行されたトークンの使い回しを防ぐため、検証時に照合する */
export type TurnstileAction = "signup" | "password_reset";

/**
 * Turnstile のトークンをサーバー側で検証する(Siteverify)。
 * TURNSTILE_SITE_KEY が未設定なら無効として常に通す(ローカル開発・導入前の互換のため)。
 * 有効なときは、シークレットや許可ホスト名の設定漏れ・検証APIの障害も含め、確認できなければすべて拒否する。
 */
export async function verifyTurnstile(
  env: Env,
  token: unknown,
  action: TurnstileAction,
  remoteIp: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SITE_KEY) return true;

  const hostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
  if (!env.TURNSTILE_SECRET || hostnames.size === 0) {
    console.error("Turnstile: TURNSTILE_SECRET または TURNSTILE_HOSTNAMES が未設定のため、リクエストを拒否しました");
    return false;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: remoteIp }),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = await res.json();
  } catch (err) {
    console.error("Turnstile: siteverify failed", err);
    return false;
  }

  return result.success === true && result.action === action && hostnames.has(result.hostname ?? "");
}
