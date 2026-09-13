export interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ENVIRONMENT: string;

  // 会員登録の受付範囲。"open"(誰でも登録可) | "domain_restricted"(ALLOWED_EMAIL_DOMAINSのみ)。
  // 未設定時は "open" として扱う。
  REGISTRATION_MODE?: string;
  // REGISTRATION_MODE=domain_restricted のときのみ参照するカンマ区切りの許可ドメイン
  // (例: "example.co.jp,example2.co.jp")。
  ALLOWED_EMAIL_DOMAINS?: string;

  // メール送信(登録確認・パスワードリセット)には Resend (https://resend.com) を使用する。
  // 機密情報のため wrangler.jsonc の vars には書かず、`wrangler secret put` で設定する。
  // 未設定の場合、実送信はスキップされコンソールにログ出力されるのみ(ローカル開発用)。
  RESEND_API_KEY?: string;
  // Resend側で送信元ドメイン認証(SPF/DKIM)を済ませたアドレスを指定する。
  RESEND_FROM_EMAIL?: string;
  // メール本文中のリンク生成に使うベースURL。未設定時はリクエストのoriginを使う。
  APP_BASE_URL?: string;
}

export interface AuthUser {
  email: string;
  displayName: string;
}

export type ItemType = "skill" | "prompt";
export type SortOption = "newest" | "updated" | "popular" | "favorites" | "name";
export type RankingPeriod = "all" | "7d" | "30d";

export interface ItemRow {
  id: string;
  type: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  body: string;
  r2_key: string | null;
  file_name: string | null;
  file_size: number | null;
  version: string;
  author_email: string;
  usage_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: number;
  name: string;
  label: string;
  is_default: number;
  item_count?: number;
}

export interface UserProfileRow {
  email: string;
  display_name: string;
}
