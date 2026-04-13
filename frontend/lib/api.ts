import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

// All requests go through Next.js rewrites (/api/* → backend:5000/api/*)
// This means the browser never sees the raw backend URL — reduces attack surface.
const api = axios.create({
  baseURL: "/api",
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true, // send cookies on cross-origin (future HttpOnly cookie support)
});

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
// Attach JWT Bearer token from in-memory store on every authenticated request.
// Token lives in Zustand (memory) — never in localStorage (XSS resistant).
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Access token directly from store outside of React tree
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR ────────────────────────────────────────────────────
// Handle 401 globally — clear auth state and redirect to login.
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — force logout
      useAuthStore.getState().logout();
      // Only redirect in browser environment
      if (typeof window !== "undefined") {
        window.location.href = "/login?session=expired";
      }
    }
    return Promise.reject(error);
  }
);

// ─── TYPED API METHODS ───────────────────────────────────────────────────────

import type {
  AuthResponse,
  SignupPayload,
  LoginPayload,
  ApplyResponse,
  StatusResponse,
  RegistrationPayload,
} from "@/types";

export const authApi = {
  signup: (data: SignupPayload) =>
    api.post<AuthResponse>("/auth/signup", data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", data),
};

export const registrationApi = {
  apply: (data: RegistrationPayload) =>
    api.post<ApplyResponse>("/registration/apply", data),

  getStatus: () =>
    api.get<StatusResponse>("/registration/status"),
};

export const healthApi = {
  check: () =>
    api.get<{ status: string; service: string }>("/health"),
};

export default api;
