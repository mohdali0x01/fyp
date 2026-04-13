"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { signupSchema, type SignupFormValues } from "@/lib/validators";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { extractErrorMessage } from "@/lib/utils";

// Visual password-strength indicator
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Lowercase", pass: /[a-z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special char", pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const pct = (passed / checks.length) * 100;
  const color = pct < 40 ? "bg-red-500" : pct < 80 ? "bg-amber-500" : "bg-emerald-500";

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs flex items-center gap-0.5 ${c.pass ? "text-emerald-400" : "text-slate-600"}`}>
            {c.pass ? <CheckCircle className="w-2.5 h-2.5" /> : <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" /> {message}
    </p>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
    </label>
  );
}

function Input({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 rounded-lg text-sm bg-slate-900/70 border text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
        error ? "border-red-500/60 focus:ring-red-500/30" : "border-slate-700 hover:border-slate-600"
      }`}
    />
  );
}

export function SignupForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const passwordValue = watch("password", "");

  const onSubmit = async (data: SignupFormValues) => {
    setServerError(null);
    try {
      const res = await authApi.signup(data);
      login(res.data.token, res.data.user);
      toast.success("Account created! Let's submit your application.");
      router.replace("/apply");
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass-card p-5 sm:p-8 space-y-5">
      {serverError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {serverError}
        </div>
      )}

      {/* Username */}
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" type="text" autoComplete="username" placeholder="ali_khan_92" error={!!errors.username} {...register("username")} />
        <FieldError message={errors.username?.message} />
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone_number">Phone Number</Label>
        <Input id="phone_number" type="tel" autoComplete="tel" placeholder="03001234567" error={!!errors.phone_number} {...register("phone_number")} />
        <FieldError message={errors.phone_number?.message} />
      </div>

      {/* Password */}
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            error={!!errors.password}
            style={{ paddingRight: "2.75rem" }}
            {...register("password")}
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label="Toggle password visibility">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <PasswordStrength password={passwordValue} />
        <FieldError message={errors.password?.message} />
      </div>

      {/* Confirm Password */}
      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            error={!!errors.confirmPassword}
            style={{ paddingRight: "2.75rem" }}
            {...register("confirmPassword")}
          />
          <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label="Toggle password visibility">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <FieldError message={errors.confirmPassword?.message} />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:translate-y-0 mt-2"
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
        ) : (
          <><UserPlus className="w-4 h-4" /> Create Account</>
        )}
      </button>

      <p className="text-center text-xs text-slate-700">
        By registering, your data is processed under AidLedger&apos;s privacy policy.
        CNIC is stored as a keccak256 hash on the blockchain.
      </p>
    </form>
  );
}
