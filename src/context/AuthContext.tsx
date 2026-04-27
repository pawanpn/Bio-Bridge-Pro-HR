import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { AppRole, normalizeRole } from '@/config/accessPolicy';
import { getPortalForRole, type PortalType } from '@/config/portalPolicy';

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: AppRole;
  branch_id?: string;
  branch_ids?: string[];
  department_id?: string;
  designation_id?: string;
  organization_id?: string;
  organization_name?: string | null;
  organization_status?: string | null;
  organization_license_expiry?: string | null;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string, expectedPortal?: PortalType) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  resetPassword: (emailOrId: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  isImpersonating: boolean;
  effectiveOrganizationId: string | undefined;
  impersonatedOrgName: string | null;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const forceSuperAdminView = import.meta.env.DEV && !isTauri();

  const clearLocalSession = () => {
    localStorage.removeItem('biobridge_user');
    localStorage.removeItem('biobridge_local_user');
  };

  const saveLocalSession = (userData: User) => {
    const serialized = JSON.stringify(userData);
    localStorage.setItem('biobridge_user', serialized);
    localStorage.setItem('biobridge_local_user', serialized);
  };

  // Check for existing session on mount (session persistence)
  useEffect(() => {
    // Safety timeout: Force loading to false after 3 seconds
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('⏱️ Loading timeout reached, forcing login page to show');
        setLoading(false);
      }
    }, 3000);

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          loadUserProfile(session.user); // Don't await, let it run in background
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSupabaseUser(null);
          clearLocalSession();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const checkSession = async () => {
    try {
      console.log('🔍 Checking existing session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('✅ Found existing session for:', session.user.email);
        loadUserProfile(session.user); // Don't await
      } else {
        try {
          const storedLocal = localStorage.getItem('biobridge_local_user') || localStorage.getItem('biobridge_user');
          if (storedLocal) {
            const parsed = JSON.parse(storedLocal);
            if (parsed?.username && parsed?.role) {
              setUser(parsed);
              setSupabaseUser(null);
              console.log('✅ Restored local SQLite session for:', parsed.username);
            }
          } else {
            console.log('⚠️ No existing session');
          }
        } catch (storageError) {
          console.warn('Failed to restore local session:', storageError);
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      console.log('🏁 Session check complete, setting loading to false');
      setLoading(false);
    }
  };

  const buildUserProfile = async (supabaseAuthUser: SupabaseUser): Promise<User | null> => {
    try {
      console.log('👤 Loading user profile for:', supabaseAuthUser.email);

      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', supabaseAuthUser.id)
        .single();

      if (error) {
        console.error('❌ Error loading user profile:', error.message);
        return {
          id: supabaseAuthUser.id,
          username: supabaseAuthUser.email?.split('@')[0] || 'user',
          email: supabaseAuthUser.email || '',
          full_name: supabaseAuthUser.user_metadata?.full_name,
          role: 'SUPER_ADMIN',
        };
      }

      const { data: branchAccessData } = await supabase
        .from('user_branch_access')
        .select('branch_id')
        .eq('user_id', userProfile.id);

      let organizationData: {
        name?: string | null;
        org_status?: string | null;
        status?: string | null;
        license_expiry?: string | null;
      } | null = null;

      if (userProfile.organization_id) {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('name, org_status, status, license_expiry')
          .eq('id', userProfile.organization_id)
          .maybeSingle();
        organizationData = orgRow || null;
      }

      const userBranchIds = (branchAccessData || [])
        .map((row: any) => row.branch_id)
        .filter(Boolean);

      return {
        id: userProfile.id,
        username: userProfile.username,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role: forceSuperAdminView ? 'SUPER_ADMIN' : normalizeRole(userProfile.role),
        branch_id: userProfile.branch_id,
        branch_ids: userBranchIds,
        department_id: userProfile.department_id,
        designation_id: userProfile.designation_id,
        organization_id: userProfile.organization_id,
        organization_name: organizationData?.name || null,
        organization_status: organizationData?.org_status || organizationData?.status || null,
        organization_license_expiry: organizationData?.license_expiry || null,
        must_change_password: false
      };
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
      return null;
    }
  };

  const loadUserProfile = async (supabaseAuthUser: SupabaseUser) => {
    const userData = await buildUserProfile(supabaseAuthUser);
    if (!userData) return;

    setUser(userData);
    setSupabaseUser(supabaseAuthUser);
    saveLocalSession(userData);
    console.log('✅ User loaded successfully:', userData.role);
  };

  const login = async (emailOrId: string, password: string, expectedPortal?: PortalType) => {
    try {
      console.log('🔐 Attempting login for:', emailOrId);

      let loginEmail = emailOrId.trim();
      const isEmailInput = loginEmail.includes('@');

      // Always try local SQLite auth first (works for both email and username)
      try {
        const localResponse: any = await invoke('authenticate_local_user', {
          identifier: loginEmail,
          password
        });

        const localUser = localResponse?.user;
        if (localResponse?.success && localUser) {
            const localUserData: User = {
              id: String(localUser.id),
              username: localUser.username,
              email: localUser.email || '',
              full_name: localUser.full_name || undefined,
              role: normalizeRole(localUser.role),
              branch_id: localUser.branch_id ?? undefined,
              branch_ids: Array.isArray(localUser.branch_ids) ? localUser.branch_ids : [],
              organization_id: localUser.organization_id ? String(localUser.organization_id) : undefined,
              must_change_password: Boolean(localUser.must_change_password),
            };

            if (expectedPortal && getPortalForRole(localUserData.role) !== expectedPortal) {
              clearLocalSession();
              setUser(null);
              setSupabaseUser(null);
              return { success: false, error: `This account belongs to the ${getPortalForRole(localUserData.role)} portal.` };
            }

            setUser(localUserData);
            setSupabaseUser(null);
            saveLocalSession(localUserData);
            console.log('✅ Local SQLite login successful for:', localUserData.username);
            return { success: true };
          }
        } catch (localError: any) {
          console.log('Local login fallback unavailable or rejected:', localError?.message || localError);
        }
      }

      if (!isEmailInput) {
        if (loginEmail.toLowerCase() === 'admin') {
          loginEmail = 'admin@biobridge.com';
        } else {
          const { data: userRecord, error: lookupError } = await supabase
            .from('users')
            .select('email')
            .eq('username', loginEmail)
            .maybeSingle();

          if (!userRecord?.email) {
            console.log('Lookup fallback failed for employee ID');
            return { success: false, error: 'Invalid Employee ID or Email' };
          }
          loginEmail = userRecord.email;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });

      if (error) {
        console.error('❌ Login error:', error.message);
        return { success: false, error: error.message };
      }

      // Check if user is deleted after successful auth
      const { data: profileCheck } = await supabase
        .from('users')
        .select('status')
        .eq('auth_id', data.user.id)
        .single();

      if (profileCheck?.status === 'deleted') {
        await supabase.auth.signOut();
        return { success: false, error: 'User does not exist or contact administrator' };
      }

      if (data.user) {
        console.log('✅ Supabase Auth successful');
        const profile = await buildUserProfile(data.user);
        if (!profile) {
          await supabase.auth.signOut();
          clearLocalSession();
          return { success: false, error: 'Unable to load user profile' };
        }

        if (expectedPortal && getPortalForRole(profile.role) !== expectedPortal) {
          await supabase.auth.signOut();
          clearLocalSession();
          setUser(null);
          setSupabaseUser(null);
          return { success: false, error: `This account belongs to the ${getPortalForRole(profile.role)} portal.` };
        }

        setUser(profile);
        setSupabaseUser(data.user);
        saveLocalSession(profile);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      console.error('❌ Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const changePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Update must_change_password flag (but we're ignoring it anyway)
      if (user) {
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id);

        const updatedUser = { ...user, must_change_password: false };
        setUser(updatedUser);
        localStorage.setItem('biobridge_user', JSON.stringify(updatedUser));
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      throw error;
    }
  };

  const resetPassword = async (emailOrId: string) => {
    try {
      let resetEmail = emailOrId.trim();

      if (!resetEmail.includes('@')) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('email')
          .eq('username', resetEmail)
          .maybeSingle();

        if (!userRecord?.email) {
           return { success: false, error: 'User does not exist with this ID' };
        }
        resetEmail = userRecord.email;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  };

  const getEffectiveOrgId = (): string | undefined => {
    const impersonatedId = sessionStorage.getItem('impersonated_org_id');
    if (impersonatedId) return impersonatedId;
    return user?.organization_id;
  };

  const isImpersonating = !!sessionStorage.getItem('impersonated_org_id');
  const impersonatedOrgName = sessionStorage.getItem('impersonated_org_name');

  const stopImpersonating = () => {
    sessionStorage.removeItem('impersonated_org_id');
    sessionStorage.removeItem('impersonated_org_name');
    sessionStorage.removeItem('provider_original_portal');
    window.location.href = '/provider/dashboard';
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem('impersonated_org_id');
      sessionStorage.removeItem('impersonated_org_name');
      sessionStorage.removeItem('provider_original_portal');
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      clearLocalSession();
      console.log('👋 Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      supabaseUser,
      login, 
      logout, 
      changePassword,
      resetPassword,
      loading,
      isImpersonating,
      effectiveOrganizationId: getEffectiveOrgId(),
      impersonatedOrgName,
      stopImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
