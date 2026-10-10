import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile の読み込みに失敗しました"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * サーバーの公開設定から Turnstile のサイトキーを取得する。
 * undefined: 取得中 / null: 未設定(ボット対策なし) / 文字列: サイトキー
 */
export function useTurnstileSiteKey(): string | null | undefined {
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    api.auth
      .config()
      .then((res) => setSiteKey(res.turnstileSiteKey))
      .catch(() => setSiteKey(null));
  }, []);
  return siteKey;
}

interface Props {
  siteKey: string;
  /** サーバー側で照合する画面ごとの識別子(worker/src/lib/auth/turnstile.ts の TurnstileAction) */
  action: "signup" | "password_reset";
  /** トークンが発行されたら文字列、期限切れ・エラー時は null を渡す */
  onToken: (token: string | null) => void;
}

/**
 * Cloudflare Turnstile のウィジェット。トークンは1回しか使えないため、送信に失敗して再試行させる場合は
 * 呼び出し側で key を変えて作り直す(新しいトークンが発行される)。
 */
export default function TurnstileWidget({ siteKey, action, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);

  return <div ref={containerRef} className="flex justify-center" />;
}
