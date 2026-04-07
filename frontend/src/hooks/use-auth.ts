// ============================================================
// COD CRM — useAuth Hook
// ============================================================

"use client";

import { useAuthStore } from "@/stores";
import { UserRole } from "@/types";

export function useAuth() {
  const { user, store, isAuthenticated, isLoading, login, adminLogin, register, logout, fetchProfile, adminFetchProfile } =
    useAuthStore();

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    // Super admin & Owner always have access
    if (user.role === "super_admin" || user.role === "owner") return true;
    return roleArray.includes(user.role);
  };

  const isSuperAdmin = user?.role === "super_admin";
  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;

  return {
    user,
    store,
    isAuthenticated,
    isLoading,
    hasRole,
    isSuperAdmin,
    isOwner,
    isAdmin,
    login,
    adminLogin,
    register,
    logout,
    fetchProfile,
    adminFetchProfile,
  };
}
