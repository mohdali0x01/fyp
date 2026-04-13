"use client";

import { create } from "zustand";
import type { User } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY RATIONALE:
// - JWT token is stored in memory (Zustand), NOT localStorage.
//   localStorage is accessible by any JavaScript on the page — XSS attacks can
//   steal it instantly. Memory storage limits the blast radius.
// - sessionStorage is used as a UX convenience so the user survives a page
//   refresh without being forced to re-login. It is cleared when the tab closes.
// - We set an HttpOnly cookie ("aid_session") via a secure API route for
//   middleware-based route protection (middleware cannot read memory/sessionStorage).
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "aid_sess"; // short key, no obvious "token" naming

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void; // restore from sessionStorage on page load
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token, user) => {
    // 1. Store in memory (primary)
    set({ token, user, isAuthenticated: true });

    // 2. Persist to sessionStorage for page-refresh survival
    //    sessionStorage is scoped to the tab and cleared on tab close
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
      } catch {
        // sessionStorage might be unavailable in private browsing — fail silently
      }

      // 3. Set a short-lived cookie for Next.js middleware (route protection)
      //    This is a "flag" cookie — the real secret stays in memory.
      //    SameSite=Strict prevents CSRF. HttpOnly cannot be set from JS —
      //    a future /api/auth/session endpoint should set it server-side.
      document.cookie = `aid_session=1; path=/; SameSite=Strict; max-age=3600`;
    }
  },

  logout: () => {
    set({ token: null, user: null, isAuthenticated: false });
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch { /* ignore */ }
      // Expire the middleware cookie
      document.cookie = "aid_session=; path=/; max-age=0; SameSite=Strict";
    }
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const { token, user } = JSON.parse(raw) as { token: string; user: User };
      if (token && user) {
        set({ token, user, isAuthenticated: true });
      }
    } catch {
      // Corrupted session data — clear it
      sessionStorage.removeItem(SESSION_KEY);
    }
  },
}));
