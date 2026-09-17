/**
 * Cloudflare Email Service の send_email バインディング(env.EMAIL)の型。
 * @cloudflare/workers-types が追随する前に新しいオブジェクト形式のsend()を使うため、
 * 必要な範囲だけ自前で定義する(Workers Paidプランでのみ実際に送信できる)。
 */
export interface CloudflareEmailBinding {
  send(message: {
    to: string;
    from: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
}

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

  // メール送信(登録確認・パスワードリセット)の送信方式。
  // "resend"(既定, 未設定時もこちら): Resend (https://resend.com) のHTTP APIを使う。Workers Freeプランでも利用可。
  // "cloudflare": Cloudflare Email Service (env.EMAILバインディング)を使う。Workers Paidプラン限定。
  // 詳細は docs/setup-selfauth.md 参照。
  EMAIL_PROVIDER?: string;

  // メール送信(登録確認・パスワードリセット)には Resend (https://resend.com) を使用する。
  // 機密情報のため wrangler.jsonc の vars には書かず、`wrangler secret put` で設定する。
  // 未設定の場合、実送信はスキップされコンソールにログ出力されるのみ(ローカル開発用)。
  RESEND_API_KEY?: string;
  // Resend側で送信元ドメイン認証(SPF/DKIM)を済ませたアドレスを指定する。
  RESEND_FROM_EMAIL?: string;

  // EMAIL_PROVIDER=cloudflare のときの送信元アドレス。Cloudflare Email Serviceで
  // ドメイン認証(Onboard Domain)を済ませたドメインのアドレスを指定する必要がある。
  EMAIL_FROM_ADDRESS?: string;
  // wrangler.jsonc の send_email バインディング。EMAIL_PROVIDER=cloudflare のときのみ使用する。
  EMAIL?: CloudflareEmailBinding;

  // メール本文中のリンク生成に使うベースURL。未設定時はリクエストのoriginを使う。
  APP_BASE_URL?: string;

  // 外部紹介(OSS等)投稿時のGitHubメタデータ自動取得で使う任意のトークン。
  // 未設定でも動作するが(GitHub API未認証枠、60回/時/IP)、設定するとレート制限が緩和される。
  GITHUB_TOKEN?: string;
}

export interface AuthUser {
  email: string;
  displayName: string;
}

export type ItemType = "skill" | "prompt" | "external";
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
  source_url: string | null;
  source_author: string | null;
  license: string | null;
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
  given_name: string | null;
  surname: string | null;
  company_name: string | null;
  job_title: string | null;
  department: string | null;
  employee_type: string | null;
}
