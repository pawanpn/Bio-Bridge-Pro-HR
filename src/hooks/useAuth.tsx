// ============================================================
// Bio-Bridge Pro HR — useAuth Hook
// Single source of truth for session state.
// Reads from Tauri secure store — not from Supabase JS client.
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api from "../services/api";
import type { AuthUser } from "../types";

// ─── Context ─────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.auth.get_current_user();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  // On mount — check if there's already an active session
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const resp = await api.auth.login({ username, password });
    setUser(resp.user);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Permission helpers ───────────────────────────────────────

/** Check a single permission */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

/** Check multiple permissions — returns true if user has ALL of them */
export function usePermissions(permissions: string[]): boolean {
  const { user } = useAuth();
  return permissions.every(p => user?.permissions?.includes(p));
}

/** Check if user has any of the given roles */
export function useHasRole(roles: AuthUser["role"][]): boolean {
  const { user } = useAuth();
  return roles.includes(user?.role as AuthUser["role"]);
}
