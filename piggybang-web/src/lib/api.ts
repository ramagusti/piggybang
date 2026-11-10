import Cookies from "js-cookie";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
export const TOKEN_COOKIE = "pb_token";

export const getToken = () => Cookies.get(TOKEN_COOKIE);
export function setToken(token: string, remember = true) {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: remember ? 30 : undefined,
    sameSite: "lax",
    secure: typeof location !== "undefined" && location.protocol === "https:",
  });
}
export const clearToken = () => Cookies.remove(TOKEN_COOKIE);

export interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
  [k: string]: unknown;
}

export class ApiError extends Error {
  constructor(public status: number, public data: ApiErrorBody) {
    super(data?.message ?? `HTTP ${status}`);
  }
  /** First validation message for a field, if any. */
  field(name: string) {
    return this.data.errors?.[name]?.[0];
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
interface Opts {
  method?: string;
  body?: unknown;
  query?: Query;
  raw?: boolean;
}

export async function api<T = unknown>(path: string, { method = "GET", body, query, raw }: Opts = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const token = getToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  if (raw) return res as T;
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Authenticated file download (exports). */
export async function download(path: string, query: Query, fallbackName: string) {
  const res = await api<Response>(path, { query, raw: true });
  const name = res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href, download: name });
  a.click();
  URL.revokeObjectURL(href);
}
