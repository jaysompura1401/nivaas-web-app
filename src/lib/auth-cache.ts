/**
 * auth-cache.ts — lightweight auth cache backed by the MySQL API.
 * Replaces the old Supabase-based version.
 */
import { auth as authApi, getToken, removeToken, setToken, type ApiUser } from "./api";

const CACHE_KEY = "nivaas_user";
const TTL_MS    = 30 * 60 * 1000; // 30 min

export type CachedProfile = ApiUser;

interface Cache {
  profile: CachedProfile;
  cachedAt: number;
}

// ─── Read / Write ─────────────────────────────────────────────────────────────

export function readAuthCache(): CachedProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (Date.now() - parsed.cachedAt > TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.profile;
  } catch {
    return null;
  }
}

export function writeAuthCache(profile: CachedProfile): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, cachedAt: Date.now() }));
}

export function clearAuthCache(): void {
  localStorage.removeItem(CACHE_KEY);
  removeToken();
}

// ─── Fetch from API ───────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<CachedProfile | null> {
  if (!getToken()) return null;
  try {
    const user = await authApi.me();
    writeAuthCache(user);
    return user;
  } catch {
    clearAuthCache();
    return null;
  }
}

export async function getProfile(): Promise<CachedProfile | null> {
  const cached = readAuthCache();
  if (cached) return cached;
  return fetchProfile();
}

export async function signOutUser(): Promise<void> {
  clearAuthCache();
}

/** Call after a successful login/register response */
export function storeAuthResponse(token: string, user: CachedProfile): void {
  setToken(token);
  writeAuthCache(user);
}
