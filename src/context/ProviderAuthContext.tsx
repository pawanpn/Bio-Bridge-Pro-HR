import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProviderUser {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'PROVIDER';
  organization_id?: string;
}

interface ProviderAuthContextType {
  providerUser: ProviderUser | null;
  loading: boolean;
  providerLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  providerLogout: () => Promise<void>;
}

const ProviderAuthContext = createContext<ProviderAuthContextType | undefined>(undefined);

export const ProviderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providerUser, setProviderUser] = useState<ProviderUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 3000);

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadProviderProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setProviderUser(null);
        localStorage.removeItem('biobridge_provider');
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        loadProviderProfile(session.user);
      }
    } catch (error) {
      console.error('Provider session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProviderProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .eq('role', 'PROVIDER')
        .single();

      if (userProfile) {
        const pUser: ProviderUser = {
          id: userProfile.id,
          username: userProfile.username,
          email: userProfile.email,
          full_name: userProfile.full_name,
          role: 'PROVIDER',
          organization_id: userProfile.organization_id,
        };
        setProviderUser(pUser);
        localStorage.setItem('biobridge_provider', JSON.stringify(pUser));
      } else {
        setProviderUser(null);
      }
    } catch (error) {
      console.error('Error loading provider profile:', error);
      setProviderUser(null);
    }
  };

  const providerLogin = async (email: string, password: string) => {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('email, role')
        .eq('email', email)
        .eq('role', 'PROVIDER')
        .single();

      if (!userRecord) {
        return { success: false, error: 'Not authorized as Provider. Provider access only.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await loadProviderProfile(data.user);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const providerLogout = async () => {
    await supabase.auth.signOut();
    setProviderUser(null);
    localStorage.removeItem('biobridge_provider');
  };

  return (
    <ProviderAuthContext.Provider value={{ providerUser, loading, providerLogin, providerLogout }}>
      {children}
    </ProviderAuthContext.Provider>
  );
};

export const useProviderAuth = () => {
  const context = useContext(ProviderAuthContext);
  if (!context) throw new Error('useProviderAuth must be used within ProviderAuthProvider');
  return context;
};
