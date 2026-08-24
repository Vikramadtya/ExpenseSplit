import { create } from 'zustand';

interface AppState {
  globalAnalytics: any | null;
  globalBalances: any | null;
  setGlobalData: (analytics: any, balances: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  globalAnalytics: null,
  globalBalances: null,
  setGlobalData: (analytics, balances) =>
    set({ globalAnalytics: analytics, globalBalances: balances }),
}));
