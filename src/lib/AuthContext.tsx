/**
 * AuthContext.tsx — backed by MySQL API via JWT tokens.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type CachedProfile,
  clearAuthCache,
  fetchProfile,
  getProfile,
  storeAuthResponse,
} from "./auth-cache";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  profile: CachedProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
  /** Call after a successful login/register API response */
  applyAuth: (token: string, user: CachedProfile) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProfile().then((p) => {
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await fetchProfile();
    setProfile(fresh);
  }, []);

  const signOut = useCallback(() => {
    clearAuthCache();
    setProfile(null);
  }, []);

  const applyAuth = useCallback((token: string, user: CachedProfile) => {
    storeAuthResponse(token, user);
    setProfile(user);
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, refresh, signOut, applyAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
