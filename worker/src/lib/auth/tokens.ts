const RAW_TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** ユーザーに渡す(メールリンク・Cookie等)生トークンを発行する。DBにはこの値自体を保存しない。 */
export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(RAW_TOKEN_BYTES)));
}

/** 生トークンをDB保存用にハッシュ化する(SHA-256, hex)。ハッシュ化は照合専用でソルト不要。 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}
