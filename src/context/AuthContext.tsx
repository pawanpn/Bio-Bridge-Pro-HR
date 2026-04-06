import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface User {
  id: number;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  branchId?: number;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ mustChange: boolean }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('biobridge_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await invoke<any>('login', { username, password });
    const userData = {
      id: res.id,
      username,
      role: res.role,
      branchId: res.branchId,
      mustChangePassword: res.mustChangePassword
    };
    
    if (!res.mustChangePassword) {
      setUser(userData);
      localStorage.setItem('biobridge_user', JSON.stringify(userData));
    } else {
      // Temp state for password change
      setUser(userData);
    }
    return { mustChange: res.mustChangePassword };
  };

  const changePassword = async (newPassword: string) => {
    await invoke('change_password', { newPassword });
    if (user) {
      const updatedUser = { ...user, mustChangePassword: false };
      setUser(updatedUser);
      localStorage.setItem('biobridge_user', JSON.stringify(updatedUser));
    }
  };

  const logout = async () => {
    try { await invoke('logout'); } catch {}
    setUser(null);
    localStorage.removeItem('biobridge_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
