import { create } from 'zustand';
import type { User } from '@shared/types';
interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateBalance: (newBalance: number) => void;
  addPurchase: (accountId: string) => void;
  logout: () => void;
}
const STORAGE_KEY = 'milfasell_user';
/**
 * useUserStore - Primitive selection pattern is enforced.
 * Patterns like useUserStore(s => ({...})) are BANNED.
 */
export const useUserStore = create<UserState>((set) => ({
  user: (() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  })(),
  isLoading: false,
  error: null,
  setUser: (user) => set(() => {
    const updatedUser = user;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (updatedUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return { user: updatedUser };
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateBalance: (newBalance) => set((state) => {
    if (!state.user) return state;
    const updatedUser = { ...state.user, balance: newBalance };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    }
    return { user: updatedUser };
  }),
  addPurchase: (accountId) => set((state) => {
    if (!state.user) return state;
    const currentPurchases = state.user.purchasedAccountIds || [];
    if (currentPurchases.includes(accountId)) return state;
    const updatedUser = {
      ...state.user,
      purchasedAccountIds: [...currentPurchases, accountId]
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    }
    return { user: updatedUser };
  }),
  logout: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ user: null });
  }
}));