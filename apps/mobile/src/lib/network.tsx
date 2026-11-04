import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

const NetworkContext = createContext<{ online: boolean }>({ online: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(isOnline);
      onlineManager.setOnline(isOnline);
    });
    return unsub;
  }, []);
  return <NetworkContext.Provider value={{ online }}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
