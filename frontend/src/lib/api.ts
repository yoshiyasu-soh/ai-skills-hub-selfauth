import type {
  ApiTokenSummary,
  Item,
  NewApiToken,
  ProfileUpdatePayload,
  RankingPeriod,
  SortOption,
  Tag,
  User,
  VersionNotification,
} from "./types";

const API_BASE = "/api";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      if (data?.error) message = data.message ? `${data.error}: ${data.message}` : data.error;
    } catch {
      // レスポンスがJSONでない場合はデフォルトメッセージを使う
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) usp.set(key, value.join(","));
    } else {
      usp.set(key, String(value));
    }
  }
  return usp.toString();
}

export interface ListItemsParams {
  type?: "skill" | "prompt";
  q?: string;
  tags?: number[];
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  authorEmail?: string;
}

export interface ListItemsResult {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

export const api = {
  me: () => request<{ user: User }>("/me"),
  updateProfile: (payload: ProfileUpdatePayload) =>
    request<{ user: User }>("/me", { method: "PATCH", body: JSON.stringify(payload) }),

  tokens: {
    list: () => request<{ tokens: ApiTokenSummary[] }>("/me/tokens"),
    create: (label?: string) =>
      request<NewApiToken>("/me/tokens", { method: "POST", body: JSON.stringify({ label }) }),
    remove: (id: number) => request<{ ok: true }>(`/me/tokens/${id}`, { method: "DELETE" }),
  },

  auth: {
    register: (email: string, password: string) =>
      request<{ ok: true; message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    verifyEmail: (token: string) =>
      request<{ ok: true; email: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
    requestPasswordReset: (email: string) =>
      request<{ ok: true; message: string }>("/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<{ ok: true }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
  },

  tags: {
    list: () => request<{ tags: Tag[] }>("/tags"),
    create: (name: string) =>
      request<{ tag: Tag }>("/tags", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (id: number) => request<{ ok: true }>(`/tags/${id}`, { method: "DELETE" }),
  },

  items: {
    list: (params: ListItemsParams) =>
      request<ListItemsResult>(`/items?${buildQuery(params as Record<string, unknown>)}`),
    get: (id: string) => request<{ item: Item }>(`/items/${id}`),
    create: (payload: FormData | Record<string, unknown>) =>
      request<{ item: Item }>("/items", {
        method: "POST",
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }),
    update: (id: string, payload: FormData | Record<string, unknown>) =>
      request<{ item: Item }>(`/items/${id}`, {
        method: "PUT",
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }),
    remove: (id: string) => request<{ ok: true }>(`/items/${id}`, { method: "DELETE" }),
    downloadUrl: (id: string) => `${API_BASE}/items/${id}/download`,
    copy: (id: string) => request<{ usageCount: number }>(`/items/${id}/copy`, { method: "POST" }),
    favorite: (id: string) =>
      request<{ favorited: boolean; favoriteCount: number }>(`/items/${id}/favorite`, { method: "POST" }),
    unfavorite: (id: string) =>
      request<{ favorited: boolean; favoriteCount: number }>(`/items/${id}/favorite`, { method: "DELETE" }),
  },

  favorites: {
    list: () => request<{ items: Item[] }>("/favorites"),
  },

  ranking: {
    list: (params: { type?: "skill" | "prompt"; period?: RankingPeriod; limit?: number }) =>
      request<{ items: Item[]; period: string; type: string }>(
        `/ranking?${buildQuery(params as Record<string, unknown>)}`,
      ),
  },

  users: {
    get: (email: string) => request<{ user: User }>(`/users/${encodeURIComponent(email)}`),
  },

  notifications: {
    list: () => request<{ notifications: VersionNotification[]; unreadCount: number }>("/notifications"),
    readAll: () => request<{ ok: true }>("/notifications/read-all", { method: "POST" }),
  },
};

export { ApiError };
