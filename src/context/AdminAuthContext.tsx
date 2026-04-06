import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AdminAuthContextType {
  isUnlocked: boolean;
  isPinSet: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  setPin: (currentPin: string | null, newPin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  refreshPinStatus: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPinSet, setIsPinSet] = useState(false);

  const refreshPinStatus = useCallback(async () => {
    try {
      const set = await invoke<boolean>('is_master_pin_set');
      setIsPinSet(set);
    } catch { setIsPinSet(false); }
  }, []);

  useEffect(() => { refreshPinStatus(); }, [refreshPinStatus]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const ok = await invoke<boolean>('verify_master_pin', { pin });
      return ok;
    } catch { return false; }
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const ok = await verifyPin(pin);
    if (ok) setIsUnlocked(true);
    return ok;
  }, [verifyPin]);

  const lock = useCallback(() => setIsUnlocked(false), []);

  const setPin = useCallback(async (currentPin: string | null, newPin: string): Promise<boolean> => {
    try {
      await invoke('set_master_pin', { currentPin: currentPin ?? '', newPin });
      setIsPinSet(true);
      return true;
    } catch { return false; }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isUnlocked, isPinSet, unlock, lock, setPin, verifyPin, refreshPinStatus }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
