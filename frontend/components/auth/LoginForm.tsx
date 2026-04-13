"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, Loader2, AlertCircle } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/validators";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { extractErrorMessage } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Show session-expired banner if redirected from middleware
  const sessionExpired = searchParams.get("session") === "expired";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const res = await authApi.login(data);
      login(res.data.token, res.data.user);
      toast.success("Logged in successfully");

      const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
      // Use replace so pressing Back doesn't return to login
      router.replace(callbackUrl);
    } catch (err) {
      setServerError(extractErrorMessage(err, "Invalid username or password."));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="glass-card p-5 sm:p-8 space-y-5"
    >
      {/* Session expired banner */}
      {sessionExpired && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Your session has expired. Please log in again.
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {serverError}
        </div>
      )}

      {/* Username */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1.5">
          Username
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          placeholder="your_username"
          className={`w-full px-4 py-2.5 rounded-lg text-sm bg-slate-900/70 border text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
            errors.username ? "border-red-500/60 focus:ring-red-500/30" : "border-slate-700 hover:border-slate-600"
          }`}
          {...register("username")}
        />
        {errors.username && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.username.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`w-full px-4 py-2.5 pr-11 rounded-lg text-sm bg-slate-900/70 border text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
              errors.password ? "border-red-500/60 focus:ring-red-500/30" : "border-slate-700 hover:border-slate-600"
            }`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:translate-y-0"
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
        ) : (
          <><LogIn className="w-4 h-4" /> Sign In</>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-slate-700">
        Your session is secured with JWT and expires in 1 hour.
      </p>
    </form>
  );
}
