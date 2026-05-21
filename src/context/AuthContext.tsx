import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/config/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: "SUPER_ADMIN" | "PROVIDER" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "EMPLOYEE" | "OPERATOR" | "VIEWER";
  branch_id?: string;
  department_id?: string;
  designation_id?: string;
  organization_id?: string;
  organization_name?: string;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  resetPassword: (emailOrId: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (supabaseAuthUser: SupabaseUser) => {
    try {
      const { data: userProfile, error } = await supabase
        .from("users")
        .select("*, organizations(name)")
        .eq("auth_id", supabaseAuthUser.id)
        .single();

      if (error || !userProfile) {
        // Fallback: build user from supabase auth metadata
        setUser({
          id: supabaseAuthUser.id,
          username: supabaseAuthUser.email?.split("@")[0] || "user",
          email: supabaseAuthUser.email || "",
          full_name: supabaseAuthUser.user_metadata?.full_name || "",
          role: supabaseAuthUser.user_metadata?.role || "EMPLOYEE",
        });
      } else {
        setUser({
          id: userProfile.id,
          username: userProfile.username || userProfile.email,
          email: userProfile.email,
          full_name: userProfile.full_name,
          role: userProfile.role,
          branch_id: userProfile.branch_id,
          department_id: userProfile.department_id,
          designation_id: userProfile.designation_id,
          organization_id: userProfile.organization_id,
          organization_name: userProfile.organizations?.name,
          must_change_password: userProfile.must_change_password,
        });
      }
      setSupabaseUser(supabaseAuthUser);
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      }
    } catch (err) {
      console.error("Session check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety timeout — never hang on loading forever
    const timeout = setTimeout(() => setLoading(false), 5000);

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          await loadUserProfile(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSupabaseUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      if (data.user) await loadUserProfile(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  };

  const resetPassword = async (emailOrId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailOrId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const refreshOrganization = async () => {
    if (supabaseUser) await loadUserProfile(supabaseUser);
  };

  return (
    <AuthContext.Provider value={{
      user, supabaseUser, login, logout,
      changePassword, resetPassword, loading, refreshOrganization
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
