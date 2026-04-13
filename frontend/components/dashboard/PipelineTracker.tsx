"use client";

import { CheckCircle, XCircle, Clock, ScanLine, Users, BarChart2, ClipboardList } from "lucide-react";
import type { PipelineStatus } from "@/types";
import { PIPELINE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

// The ordered steps in the happy-path pipeline
const PIPELINE_STEPS: Array<{
  status: PipelineStatus;
  failStatus?: PipelineStatus;
  label: string;
  icon: React.ElementType;
}> = [
  { status: "PENDING",          label: "Applied",      icon: ClipboardList },
  { status: "PENDING",          failStatus: "KYC_FAILED",        label: "KYC",          icon: ScanLine },
  { status: "PENDING",          failStatus: "FAMILY_INELIGIBLE", label: "Family",       icon: Users },
  { status: "PENDING",          failStatus: "PMT_FAILED",        label: "PMT Score",    icon: BarChart2 },
  { status: "ELIGIBLE",         label: "Eligible",     icon: CheckCircle },
];

// Map current status to which step is "reached"
function getStepState(stepIndex: number, currentStatus: PipelineStatus): "done" | "failed" | "active" | "inactive" {
  const failMap: Record<PipelineStatus, number> = {
    KYC_FAILED: 1,
    FAMILY_INELIGIBLE: 2,
    PMT_FAILED: 3,
    PENDING: -1,
    ELIGIBLE: -1,
  };

  if (currentStatus === "ELIGIBLE") {
    return stepIndex <= 4 ? "done" : "inactive";
  }

  const failedAt = failMap[currentStatus];
  if (failedAt !== -1) {
    if (stepIndex < failedAt) return "done";
    if (stepIndex === failedAt) return "failed";
    return "inactive";
  }

  // PENDING — only step 0 is done
  if (currentStatus === "PENDING") {
    if (stepIndex === 0) return "done";
    if (stepIndex === 1) return "active";
    return "inactive";
  }

  return "inactive";
}

export function PipelineTracker({ status }: { status: PipelineStatus }) {
  const steps = [
    { label: "Applied",    icon: ClipboardList, index: 0 },
    { label: "KYC Check",  icon: ScanLine,      index: 1 },
    { label: "Family",     icon: Users,         index: 2 },
    { label: "PMT Score",  icon: BarChart2,     index: 3 },
    { label: "Eligible",   icon: CheckCircle,   index: 4 },
  ];

  return (
    <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const state = getStepState(i, status);
        const isLast = i === steps.length - 1;

        return (
          <div key={step.index} className="flex items-center flex-1 min-w-0">
            {/* Step node */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  state === "done"     && "bg-emerald-500/15 border-emerald-500 text-emerald-400",
                  state === "failed"   && "bg-red-500/15 border-red-500 text-red-400",
                  state === "active"   && "bg-amber-500/15 border-amber-500 text-amber-400 animate-pulse",
                  state === "inactive" && "bg-slate-900 border-slate-700 text-slate-700"
                )}
              >
                {state === "done"   && <CheckCircle className="w-5 h-5" />}
                {state === "failed" && <XCircle className="w-5 h-5" />}
                {state === "active" && <Clock className="w-5 h-5" />}
                {state === "inactive" && <step.icon className="w-4 h-4" />}
              </div>
              {/* Label */}
              <span className={cn(
                "text-xs font-medium mt-2 text-center whitespace-nowrap",
                state === "done"     && "text-emerald-400",
                state === "failed"   && "text-red-400",
                state === "active"   && "text-amber-400",
                state === "inactive" && "text-slate-700",
              )}>
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 sm:mx-2 rounded-full",
                state === "done" ? "bg-emerald-500/50" :
                state === "failed" ? "bg-red-500/30" :
                "bg-slate-800"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
