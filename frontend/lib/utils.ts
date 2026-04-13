import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PipelineStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Pipeline Status Helpers ─────────────────────────────────────────────────

export const PIPELINE_STEPS: PipelineStatus[] = [
  "PENDING",
  "KYC_FAILED",
  "FAMILY_INELIGIBLE",
  "PMT_FAILED",
  "ELIGIBLE",
];

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  PENDING: "Application Received",
  KYC_FAILED: "KYC Failed",
  FAMILY_INELIGIBLE: "Family Check Failed",
  PMT_FAILED: "PMT Check Failed",
  ELIGIBLE: "Eligible",
};

export const PIPELINE_DESCRIPTIONS: Record<PipelineStatus, string> = {
  PENDING: "Your application has been received and is being processed.",
  KYC_FAILED: "Your CNIC could not be verified against NADRA records.",
  FAMILY_INELIGIBLE: "A member of your family is already receiving aid.",
  PMT_FAILED: "Your Proxy Means Test score exceeds the eligibility threshold.",
  ELIGIBLE: "Congratulations! You have been approved for aid disbursement.",
};

export const PIPELINE_COLORS: Record<PipelineStatus, string> = {
  PENDING: "text-amber-400",
  KYC_FAILED: "text-red-500",
  FAMILY_INELIGIBLE: "text-red-500",
  PMT_FAILED: "text-red-500",
  ELIGIBLE: "text-emerald-400",
};

export function isFailedStatus(status: PipelineStatus): boolean {
  return status === "KYC_FAILED" || status === "FAMILY_INELIGIBLE" || status === "PMT_FAILED";
}

// ─── Date Formatting ─────────────────────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Error Extraction ────────────────────────────────────────────────────────

export function extractErrorMessage(error: unknown, fallback = "An unexpected error occurred."): string {
  if (error && typeof error === "object") {
    const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
    return (
      axiosError.response?.data?.message ||
      axiosError.message ||
      fallback
    );
  }
  return fallback;
}
