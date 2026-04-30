import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'SUPER_ADMIN' | 'PROVIDER' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE' | 'OPERATOR' | 'VIEWER';
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
          localStorage.removeItem('biobridge_user');
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
      const impersonateData = localStorage.getItem('biobridge_impersonate_user');
      if (impersonateData) {
        const impUser = JSON.parse(impersonateData);
        console.log('🔑 Loading impersonated user:', impUser.username);
        const userData: User = {
          id: impUser.id,
          username: impUser.username,
          email: impUser.email,
          full_name: impUser.full_name,
          role: impUser.role || 'SUPER_ADMIN',
          organization_id: impUser.organization_id,
        };
        setUser(userData);
        return;
      }

      console.log('🔍 Checking existing session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('✅ Found existing session for:', session.user.email);
        loadUserProfile(session.user); // Don't await
      } else {
        console.log('⚠️ No existing session');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      console.log('🏁 Session check complete, setting loading to false');
      setLoading(false);
    }
  };

  const loadUserProfile = async (supabaseAuthUser: SupabaseUser) => {
    try {
      console.log('👤 Loading user profile for:', supabaseAuthUser.email);
      
      // Get user profile from users table (linked via auth_id)
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', supabaseAuthUser.id)
        .single();

      if (error) {
        console.error('❌ Error loading user profile:', error.message);
        // User might not have a profile yet - still allow login
        const userData: User = {
          id: supabaseAuthUser.id,
          username: supabaseAuthUser.email?.split('@')[0] || 'user',
          email: supabaseAuthUser.email || '',
          full_name: supabaseAuthUser.user_metadata?.full_name,
          role: 'SUPER_ADMIN', // Set as SUPER_ADMIN for development/setup phase
        };

        setUser(userData);
        setSupabaseUser(supabaseAuthUser);
        localStorage.setItem('biobridge_user', JSON.stringify(userData));
        console.log('✅ User loaded (default profile)');
        return;
      }

      const userData: User = {
        id: userProfile.id,
        username: userProfile.username,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role: userProfile.role || 'EMPLOYEE',
        branch_id: userProfile.branch_id,
        department_id: userProfile.department_id,
        designation_id: userProfile.designation_id,
        organization_id: userProfile.organization_id,
        must_change_password: false
      };

      // Load organization name if we have an org id
      if (userProfile.organization_id) {
        try {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', userProfile.organization_id)
            .single();
          if (org) userData.organization_name = org.name;
        } catch { /* ignore org name lookup failure */ }
      }

      setUser(userData);
      setSupabaseUser(supabaseAuthUser);
      localStorage.setItem('biobridge_user', JSON.stringify(userData));
      console.log('✅ User loaded successfully:', userData.role);
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    }
  };

  const login = async (emailOrId: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', emailOrId);
      
      let loginEmail = emailOrId.trim();

      // If it's an admin bypass shortcut or doesn't look like an email, lookup by username/employee_code
      if (!loginEmail.includes('@')) {
        if (loginEmail.toLowerCase() === 'admin') {
          loginEmail = 'admin@biobridge.com';
        } else {
          // Look up email by employee ID/username
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

      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });

      if (error) {
        console.error('❌ Login error:', error.message);
        return { success: false, error: error.message };
      }

      // Check if user is deleted or locked after successful auth
      const { data: profileCheck } = await supabase
        .from('users')
        .select('status, is_active')
        .eq('auth_id', data.user.id)
        .single();

      if (profileCheck?.status === 'deleted') {
        await supabase.auth.signOut();
        return { success: false, error: 'User does not exist or contact administrator' };
      }

      if (profileCheck?.is_active === false) {
        await supabase.auth.signOut();
        return { success: false, error: 'Your account has been locked. Contact your administrator.' };
      }

      if (data.user) {
        console.log('✅ Supabase Auth successful');
        // loadUserProfile will be called automatically via onAuthStateChange
        // But we wait a bit to ensure it's loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if user was set
        if (!user) {
          await loadUserProfile(data.user);
        }
        
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

  const logout = async () => {
    try {
      const isImpersonating = !!localStorage.getItem('biobridge_impersonate_user');
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      localStorage.removeItem('biobridge_user');
      localStorage.removeItem('biobridge_impersonate_user');
      if (isImpersonating) {
        window.location.href = '/provider/dashboard';
        return;
      }
      console.log('👋 Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshOrganization = async () => {
    if (!user?.organization_id) return;
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', user.organization_id)
        .single();
      if (org && user) {
        const updated = { ...user, organization_name: org.name };
        setUser(updated);
        localStorage.setItem('biobridge_user', JSON.stringify(updated));
      }
    } catch { /* silent */ }
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
      refreshOrganization
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
