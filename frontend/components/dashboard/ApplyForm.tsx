"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Send,
  CheckCircle,
  Hash,
  User,
  MapPin,
  Home,
  CreditCard,
  Info,
} from "lucide-react";
import { registrationSchema, type RegistrationFormValues } from "@/lib/validators";
import { registrationApi } from "@/lib/api";
import { extractErrorMessage } from "@/lib/utils";
import type { ApplyResponse, PipelineStatus } from "@/types";
import { PipelineTracker } from "./PipelineTracker";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}
    </label>
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

function InputBase({ error, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 rounded-lg text-sm bg-slate-900/70 border text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
        error ? "border-red-500/60" : "border-slate-700 hover:border-slate-600"
      } ${className}`}
    />
  );
}

export function ApplyForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ApplyResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // If already applied, don't show the form
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => registrationApi.getStatus(),
    retry: false,
  });

  const alreadyApplied = !!statusData?.data?.application;
  const existingStatus = statusData?.data?.application?.pipeline_status;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: RegistrationFormValues) => registrationApi.apply(data),
    onSuccess: (res) => {
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["status"] });
      if (res.data.verification.success) {
        toast.success("Application approved! You are eligible for aid.");
      } else {
        toast.error(`Application result: ${res.data.verification.reason || "Check details below."}`);
      }
    },
    onError: (err) => {
      setServerError(extractErrorMessage(err));
    },
  });

  const onSubmit = (data: RegistrationFormValues) => {
    setServerError(null);
    mutate(data);
  };

  // ── Already applied ──────────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="glass-card p-10 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (alreadyApplied) {
    return (
      <div className="glass-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto">
          <Info className="w-7 h-7 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200">Application Already Submitted</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          You&apos;ve already submitted an application. Each account can only have one application.
          Check your current status below.
        </p>
        {existingStatus && (
          <div className="mt-4">
            <PipelineTracker status={existingStatus as PipelineStatus} />
          </div>
        )}
        <button
          onClick={() => router.push("/status")}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all"
        >
          View Full Status
        </button>
      </div>
    );
  }

  // ── Result shown after successful submission ─────────────────────────────────
  if (result) {
    const succeeded = result.verification.success;
    return (
      <div className="space-y-5">
        {/* Result header */}
        <div className={`glass-card p-6 text-center border ${succeeded ? "border-emerald-500/30" : "border-red-500/25"}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${succeeded ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
            {succeeded
              ? <CheckCircle className="w-8 h-8 text-emerald-400" />
              : <AlertCircle className="w-8 h-8 text-red-400" />
            }
          </div>
          <h3 className={`text-xl font-bold mb-2 ${succeeded ? "text-emerald-400" : "text-red-400"}`}>
            {succeeded ? "Congratulations! You are Eligible" : "Application Unsuccessful"}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {succeeded
              ? "Your eligibility has been confirmed and anchored on the blockchain. A virtual card will be issued."
              : result.verification.reason
            }
          </p>
        </div>

        {/* Blockchain hash */}
        {succeeded && result.verification.blockchainHash && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-slate-300">Blockchain Approval Hash</span>
            </div>
            <code className="text-xs font-mono text-emerald-500/80 break-all bg-slate-900/50 p-3 rounded-lg block border border-slate-800">
              {result.verification.blockchainHash}
            </code>
            <p className="text-xs text-slate-600 mt-2">
              This hash is permanently stored on Hyperledger Besu — immutable proof of your eligibility.
            </p>
          </div>
        )}

        {/* Pipeline status */}
        <div className="glass-card p-5">
          <h4 className="text-sm font-medium text-slate-400 mb-4">Pipeline Result</h4>
          <PipelineTracker status={succeeded ? "ELIGIBLE" : ((result.verification.status as PipelineStatus) || "PENDING")} />
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ── Application form ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 text-blue-400 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          The verification pipeline runs automatically. Your CNIC is hashed with keccak256 before being stored on the blockchain — never stored as plaintext.
        </span>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {serverError}
        </div>
      )}

      {/* Personal info */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" /> Personal Information
        </h3>

        {/* Full name */}
        <div>
          <Label htmlFor="full_name">Full Name</Label>
          <InputBase id="full_name" type="text" placeholder="Muhammad Ali Khan" autoComplete="name" error={!!errors.full_name} {...register("full_name")} />
          <FieldError message={errors.full_name?.message} />
        </div>

        {/* CNIC */}
        <div>
          <Label htmlFor="cnic">CNIC Number</Label>
          <InputBase
            id="cnic"
            type="text"
            placeholder="42201-1234567-1 or 4220112345671"
            autoComplete="off"
            error={!!errors.cnic}
            {...register("cnic")}
          />
          <FieldError message={errors.cnic?.message} />
          <p className="mt-1.5 text-xs text-slate-700 flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            Your CNIC is hashed with keccak256 before blockchain storage
          </p>
        </div>
      </div>

      {/* Address */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" /> Address Details
        </h3>

        {/* Address */}
        <div>
          <Label htmlFor="address">Full Address</Label>
          <textarea
            id="address"
            placeholder="House #12, Block B, Gulshan-e-Iqbal, Karachi"
            className={`w-full px-4 py-2.5 rounded-lg text-sm bg-slate-900/70 border text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-20 ${
              errors.address ? "border-red-500/60" : "border-slate-700 hover:border-slate-600"
            }`}
            {...register("address")}
          />
          <FieldError message={errors.address?.message} />
        </div>

        {/* City */}
        <div>
          <Label htmlFor="city">City</Label>
          <InputBase
            id="city"
            type="text"
            placeholder="Karachi"
            autoComplete="address-level2"
            error={!!errors.city}
            {...register("city")}
          />
          <FieldError message={errors.city?.message} />
          <p className="mt-1.5 text-xs text-slate-700 flex items-center gap-1">
            <Home className="w-3 h-3" />
            City is used to determine Urban/Rural PMT threshold
          </p>
        </div>
      </div>

      {/* Pipeline preview */}
      <div className="glass-card p-5">
        <p className="text-xs text-slate-500 mb-4">What happens after you submit:</p>
        <div className="flex items-center justify-between gap-1 text-xs text-slate-600 overflow-x-auto">
          {["KYC Check", "Family Tree", "PMT Score", "Blockchain", "Decision"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-1 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-slate-700" />
              <span>{step}</span>
              {i < arr.length - 1 && <span className="text-slate-800 mx-1">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25"
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Running Verification Pipeline...</>
        ) : (
          <><Send className="w-4 h-4" /> Submit Application</>
        )}
      </button>
    </form>
  );
}
