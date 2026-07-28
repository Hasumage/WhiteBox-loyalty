import { getAccessToken } from "./auth-client";
import { fetchWithAuthRecovery } from "./authenticated-fetch";
import { clearTwaCache, readTwaCache, writeTwaCache } from "./twa-cache";

export type ApiCategory = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  isFavorite?: boolean;
};

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return "/backend-api";
  return "http://localhost:3001/api";
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;
const FAVORITES_CACHE_TTL_MS = 2 * 60 * 1000;
const CATEGORIES_KEY = "GET:/registered/categories";
const FAVORITES_KEY = "GET:/registered/favorite-categories";

export function getCachedRegisteredCategories(): ApiCategory[] {
  return readTwaCache<ApiCategory[]>(CATEGORIES_KEY, []).data;
}

export async function getRegisteredCategories(): Promise<ApiCategory[]> {
  const cached = readTwaCache<ApiCategory[]>(CATEGORIES_KEY, []);
  if (cached.hit && !cached.expired) return cached.data;

  try {
    const res = await fetchWithAuthRecovery(`${apiBase()}/registered/categories`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) return cached.hit ? cached.data : [];
    const data = (await res.json()) as ApiCategory[];
    writeTwaCache(CATEGORIES_KEY, data, CATEGORY_CACHE_TTL_MS);
    return data;
  } catch {
    return cached.hit ? cached.data : [];
  }
}

export function getCachedFavoriteCategorySlugs(): string[] {
  return readTwaCache<string[]>(FAVORITES_KEY, []).data;
}

export async function getFavoriteCategorySlugs(): Promise<string[]> {
  const cached = readTwaCache<string[]>(FAVORITES_KEY, []);
  if (cached.hit && !cached.expired) return cached.data;

  try {
    const res = await fetchWithAuthRecovery(`${apiBase()}/registered/favorite-categories`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) return cached.hit ? cached.data : [];
    const data = (await res.json()) as string[];
    writeTwaCache(FAVORITES_KEY, data, FAVORITES_CACHE_TTL_MS);
    return data;
  } catch {
    return cached.hit ? cached.data : [];
  }
}

export async function saveFavoriteCategorySlugs(categorySlugs: string[]) {
  const res = await fetchWithAuthRecovery(`${apiBase()}/registered/favorite-categories`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ categorySlugs }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Failed";
    return { ok: false as const, message };
  }
  const data = (await res.json()) as { favoriteCategorySlugs: string[] };
  clearTwaCache();
  writeTwaCache(FAVORITES_KEY, data.favoriteCategorySlugs, FAVORITES_CACHE_TTL_MS);
  return { ok: true as const, data };
}
