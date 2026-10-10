export type ItemType = "skill" | "prompt" | "agent" | "mod" | "external";

export interface ModFinding {
  kind: "call" | "hook" | "config";
  name: string;
  level: "high" | "medium";
  label: string;
}

export interface ModScan {
  pluginName: string;
  modules: string[];
  hooks: string[];
  calls: string[];
  envReads: string[];
  envWrites: string[];
  findings: ModFinding[];
  level: "high" | "medium" | "low";
}
export type SortOption = "newest" | "updated" | "popular" | "favorites" | "name";
export type RankingPeriod = "all" | "7d" | "30d";

export interface Tag {
  id: number;
  name: string;
  label: string;
  is_default: number;
  item_count?: number;
  isOwner: boolean;
}

export interface ItemTagRef {
  id: number;
  name: string;
  label: string;
}

export interface Item {
  id: string;
  type: ItemType;
  slug: string;
  title: string;
  summary: string;
  description: string;
  body: string;
  fileName: string | null;
  fileSize: number | null;
  version: string;
  authorId: string;
  authorName: string;
  usageCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  tags: ItemTagRef[];
  isFavorited: boolean;
  isOwner: boolean;
  hasUpdate: boolean;
  periodCount?: number;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  license: string | null;
  stars: number | null;
}

export interface Comment {
  id: number;
  itemId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

export interface ItemVersion {
  id: number;
  version: string;
  body: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface GitHubMetadata {
  title: string;
  description: string;
  author: string;
  license: string;
  stars: number;
  url: string;
}

export interface VersionNotification {
  itemId: string;
  itemType: ItemType;
  title: string;
  previousVersion: string;
  currentVersion: string;
  updatedAt: string;
}

/** 他の利用者のプロフィール。メールアドレスは含まれない(識別には公開IDを使う) */
export interface PublicUser {
  id: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  companyName: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeType: string | null;
}

/** ログイン中の本人(本人のメールアドレスを含む) */
export interface User extends PublicUser {
  email: string;
}

export interface ProfileUpdatePayload {
  displayName: string;
  givenName?: string;
  surname?: string;
  companyName?: string;
  jobTitle?: string;
  department?: string;
  employeeType?: string;
}

export interface ApiTokenSummary {
  id: number;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface NewApiToken extends ApiTokenSummary {
  token: string;
}
