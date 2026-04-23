import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE' | 'OPERATOR' | 'VIEWER';
  branch_id?: string;
  department_id?: string;
  designation_id?: string;
  organization_id?: string;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  loading: boolean;
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
        must_change_password: false // ⚠️ IGNORED - always false to skip password change screen
      };

      setUser(userData);
      setSupabaseUser(supabaseAuthUser);
      localStorage.setItem('biobridge_user', JSON.stringify(userData));
      console.log('✅ User loaded successfully:', userData.role);
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', email);
      
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      localStorage.removeItem('biobridge_user');
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
      loading
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
