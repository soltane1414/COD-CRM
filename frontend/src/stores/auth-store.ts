// ============================================================
// COD CRM — Auth Store (Zustand)
// ============================================================

import { create } from "zustand";
import { User, Store, LoginPayload, RegisterPayload } from "@/types";
import { apiClient } from "@/lib/api";
import { setTokens, clearTokens } from "@/lib/auth";

interface AuthState {
  user: User | null;
  store: Store | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (payload: LoginPayload) => Promise<void>;
  adminLogin: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  adminFetchProfile: () => Promise<void>;
  setUser: (user: User) => void;
  setStore: (store: Store) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  store: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (payload: LoginPayload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/auth/login", payload);
      const { user, tokens } = res.data.data;

      setTokens(tokens.access_token, tokens.refresh_token);
      localStorage.setItem("store_id", String(user.store_id));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  adminLogin: async (payload: LoginPayload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/admin/login", payload);
      const { user, tokens } = res.data.data;

      setTokens(tokens.access_token, tokens.refresh_token);
      localStorage.setItem("user_type", "admin");

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (payload: RegisterPayload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/auth/register", payload);
      const { user, store, tokens } = res.data.data;

      setTokens(tokens.access_token, tokens.refresh_token);
      localStorage.setItem("store_id", String(store.id));

      set({
        user,
        store,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore error — we clear tokens regardless
    } finally {
      clearTokens();
      localStorage.removeItem("user_type");
      set({ user: null, store: null, isAuthenticated: false });
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/auth/me");
      set({
        user: res.data.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  adminFetchProfile: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/admin/me");
      set({
        user: res.data.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user: User) => set({ user }),
  setStore: (store: Store) => set({ store }),
  reset: () => {
    clearTokens();
    localStorage.removeItem("user_type");
    set({ user: null, store: null, isAuthenticated: false, isLoading: false });
  },
}));
