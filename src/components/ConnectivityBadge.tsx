import React from 'react';
import { useConnectivity } from '@/hooks/useSync';
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';

export const ConnectivityBadge: React.FC = () => {
  const { isOnline, supabaseConnected, lastChecked } = useConnectivity();
  
  const timeString = lastChecked.toLocaleTimeString();
  
  if (supabaseConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
        <div className="relative">
          <Wifi size={14} className="text-green-600" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        <span className="text-xs font-medium text-green-700">Online</span>
        <span className="text-[10px] text-green-500">{timeString}</span>
      </div>
    );
  }
  
  if (isOnline && !supabaseConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200">
        <CloudOff size={14} className="text-yellow-600" />
        <span className="text-xs font-medium text-yellow-700">Limited</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
      <WifiOff size={14} className="text-red-600" />
      <span className="text-xs font-medium text-red-700">Offline</span>
      <span className="text-[10px] text-red-500">Queue Active</span>
    </div>
  );
};
