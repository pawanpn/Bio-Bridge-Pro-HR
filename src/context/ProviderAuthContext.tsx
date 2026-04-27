import React, { createContext, useContext, useState, useEffect } from 'react';

interface ProviderUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'PROVIDER';
}

interface ProviderAuthContextType {
  providerUser: ProviderUser | null;
  loading: boolean;
  providerLogin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  providerLogout: () => Promise<void>;
  isProviderPinSet: () => boolean;
  setProviderPin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
}

const ProviderAuthContext = createContext<ProviderAuthContextType | undefined>(undefined);

const DEFAULT_PROVIDER_PIN = 'provider123';
const STORAGE_KEY = 'biobridge_provider';

export const ProviderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providerUser, setProviderUser] = useState<ProviderUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id) setProviderUser(parsed);
      } catch {}
    }
    setLoading(false);
  }, []);

  const getStoredPin = (): string => {
    return localStorage.getItem('biobridge_provider_pin') || DEFAULT_PROVIDER_PIN;
  };

  const isProviderPinSet = (): boolean => {
    return !!localStorage.getItem('biobridge_provider_pin');
  };

  const setProviderPinFunc = async (currentPin: string, newPin: string) => {
    const stored = getStoredPin();
    if (stored !== currentPin) {
      return { success: false, error: 'Current PIN is incorrect' };
    }
    if (newPin.length < 6) {
      return { success: false, error: 'PIN must be at least 6 characters' };
    }
    localStorage.setItem('biobridge_provider_pin', newPin);
    return { success: true };
  };

  const providerLogin = async (pin: string) => {
    const storedPin = getStoredPin();

    if (pin === storedPin) {
      const user: ProviderUser = {
        id: 'provider-001',
        username: 'provider',
        email: 'provider@biobridge.com',
        full_name: 'System Provider',
        role: 'PROVIDER',
      };
      setProviderUser(user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return { success: true };
    }

    return { success: false, error: 'Invalid PIN' };
  };

  const providerLogout = async () => {
    setProviderUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ProviderAuthContext.Provider value={{
      providerUser, loading, providerLogin, providerLogout,
      isProviderPinSet, setProviderPin: setProviderPinFunc
    }}>
      {children}
    </ProviderAuthContext.Provider>
  );
};

export const useProviderAuth = () => {
  const context = useContext(ProviderAuthContext);
  if (!context) throw new Error('useProviderAuth must be used within ProviderAuthProvider');
  return context;
};
