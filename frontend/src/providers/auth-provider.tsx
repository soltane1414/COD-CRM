"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { isAuthenticated as hasToken } from "@/lib/auth/tokens";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — Initializes authentication state on app load.
 * Only attempts to restore session if a token already exists.
 * Anonymous visitors (no token) skip the profile fetch entirely.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { fetchProfile, adminFetchProfile, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Only try to restore session if we have a stored token
    if (!hasToken()) return;

    // Safety timeout: if auth check hangs (backend down), clear tokens after 5s
    const safetyTimeout = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isLoading) {
        import("@/lib/auth/tokens").then(({ clearTokens: clear }) => clear());
        useAuthStore.setState({ isLoading: false, isAuthenticated: false, user: null });
      }
    }, 5000);

    const initAuth = async () => {
      try {
        const userType = typeof window !== "undefined" ? localStorage.getItem("user_type") : null;
        if (userType === "admin") {
          await adminFetchProfile();
        } else {
          await fetchProfile();
        }
      } catch {
        // Token invalid, expired, or backend unreachable — clear stale tokens
        import("@/lib/auth/tokens").then(({ clearTokens: clear }) => clear());
        useAuthStore.setState({ isLoading: false, isAuthenticated: false, user: null });
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    initAuth();

    return () => clearTimeout(safetyTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading only when we have a token and are verifying it
  if (isLoading && !isAuthenticated && hasToken()) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
