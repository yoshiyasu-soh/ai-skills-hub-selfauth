import type { Env } from "../types";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Resend (https://resend.com) のHTTP APIでメールを送信する。
 * ローカル開発等で RESEND_API_KEY が未設定の場合は実送信せず、コンソールにリンク等を出力するだけにする
 * (本番相当の動作確認にはRESEND_API_KEYの設定が必要)。
 */
export async function sendEmail(env: Env, input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[email:dev] RESEND_API_KEY未設定のため送信をスキップしました。宛先=${input.to} 件名=${input.subject}\n${input.html}`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL ?? "AI Skills Hub <onboarding@resend.dev>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error: ${res.status} ${body}`);
  }
}

function appBaseUrl(env: Env, requestUrl: string): string {
  return env.APP_BASE_URL ?? new URL(requestUrl).origin;
}

export async function sendVerificationEmail(env: Env, requestUrl: string, email: string, token: string) {
  const link = `${appBaseUrl(env, requestUrl)}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail(env, {
    to: email,
    subject: "【AI Skills Hub】メールアドレスの確認",
    html: `
      <p>AI Skills Hub にご登録いただきありがとうございます。</p>
      <p>以下のリンクをクリックしてメールアドレスの確認を完了してください(24時間有効)。</p>
      <p><a href="${link}">${link}</a></p>
      <p>心当たりがない場合は、このメールを破棄してください。</p>
    `,
  });
}

export async function sendPasswordResetEmail(env: Env, requestUrl: string, email: string, token: string) {
  const link = `${appBaseUrl(env, requestUrl)}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(env, {
    to: email,
    subject: "【AI Skills Hub】パスワード再設定",
    html: `
      <p>パスワード再設定のリクエストを受け付けました。</p>
      <p>以下のリンクからパスワードを再設定してください(1時間有効)。</p>
      <p><a href="${link}">${link}</a></p>
      <p>心当たりがない場合は、このメールを破棄してください(パスワードは変更されません)。</p>
    `,
  });
}
