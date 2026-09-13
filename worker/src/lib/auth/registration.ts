import type { Env } from "../../types";

/**
 * REGISTRATION_MODE=domain_restricted のとき、ALLOWED_EMAIL_DOMAINS(カンマ区切り)に
 * 含まれるドメインのメールアドレスのみ登録を許可する。未設定(既定値)時は誰でも登録可能。
 */
export function isEmailDomainAllowed(env: Env, email: string): boolean {
  if (env.REGISTRATION_MODE !== "domain_restricted") return true;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  const allowed = (env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(domain);
}
