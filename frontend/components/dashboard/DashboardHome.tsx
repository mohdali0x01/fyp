"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { registrationApi } from "@/lib/api";
import { PIPELINE_LABELS, PIPELINE_DESCRIPTIONS, formatDate, isFailedStatus } from "@/lib/utils";
import type { PipelineStatus } from "@/types";
import { PipelineTracker } from "./PipelineTracker";
import {
  FileText,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck,
  CalendarDays,
  MapPin,
  ChevronRight,
  Activity,
  Bell,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

// Quick-stat card
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="glass-card p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${color} bg-current/10`}>
        <Icon className={`w-5 h-5 ${color}`} style={{ color: "currentcolor" }} />
      </div>
      <div className="text-lg font-bold text-slate-200">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  if (status === "ELIGIBLE") return (
    <span className="badge-eligible inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
      <CheckCircle className="w-3.5 h-3.5" /> Eligible
    </span>
  );
  if (status === "PENDING") return (
    <span className="badge-pending inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
      <Clock className="w-3.5 h-3.5" /> Pending
    </span>
  );
  return (
    <span className="badge-failed inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
      <XCircle className="w-3.5 h-3.5" /> {PIPELINE_LABELS[status]}
    </span>
  );
}

export function DashboardHome() {
  const { user } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["status"],
    queryFn: () => registrationApi.getStatus(),
    retry: 1,
  });

  const app = data?.data?.application;
  const latestNotification = app?.notifications?.[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Welcome back, <span className="gradient-text">{user?.username}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {app ? "Here's your aid application status." : "You haven't submitted an application yet."}
          </p>
        </div>
        {!app && !isLoading && (
          <Link
            href="/apply"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25 flex-shrink-0"
          >
            <FileText className="w-4 h-4" />
            Apply Now
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="flex items-center gap-3 text-emerald-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Fetching your application...</span>
          </div>
        </div>
      )}

      {/* No application yet */}
      {!isLoading && !app && (
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Application Found</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            You haven&apos;t submitted an aid application yet. Click below to start the process.
            Your eligibility is determined automatically within seconds.
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/25"
          >
            <FileText className="w-4 h-4" /> Submit Application
          </Link>
        </div>
      )}

      {/* Application found */}
      {app && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card p-4 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 mb-2">Status</div>
              <StatusBadge status={app.pipeline_status as PipelineStatus} />
            </div>
            <div className="glass-card p-4">
              <div className="text-xs text-slate-500 mb-1.5">Registration ID</div>
              <div className="font-mono font-bold text-slate-200 text-sm">#{app.registration_id}</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xs text-slate-500 mb-1.5">City / Zone</div>
              <div className="font-semibold text-slate-200 text-sm flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                {app.city || "—"}
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xs text-slate-500 mb-1.5">Applied On</div>
              <div className="text-slate-300 text-xs flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-slate-500" />
                {formatDate(app.created_at).split(",")[0]}
              </div>
            </div>
          </div>

          {/* Pipeline tracker */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Verification Pipeline
            </h3>
            <PipelineTracker status={app.pipeline_status as PipelineStatus} />
          </div>

          {/* Status detail card */}
          <div className={`glass-card p-5 border ${
            app.pipeline_status === "ELIGIBLE" ? "border-emerald-500/25" :
            isFailedStatus(app.pipeline_status as PipelineStatus) ? "border-red-500/25" :
            "border-amber-500/25"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                app.pipeline_status === "ELIGIBLE" ? "bg-emerald-500/15" :
                isFailedStatus(app.pipeline_status as PipelineStatus) ? "bg-red-500/15" :
                "bg-amber-500/15"
              }`}>
                {app.pipeline_status === "ELIGIBLE"
                  ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                  : isFailedStatus(app.pipeline_status as PipelineStatus)
                  ? <XCircle className="w-5 h-5 text-red-400" />
                  : <Clock className="w-5 h-5 text-amber-400" />
                }
              </div>
              <div>
                <div className="font-semibold text-slate-200 text-sm mb-1">
                  {PIPELINE_LABELS[app.pipeline_status as PipelineStatus]}
                </div>
                <p className="text-sm text-slate-500">
                  {PIPELINE_DESCRIPTIONS[app.pipeline_status as PipelineStatus]}
                </p>
              </div>
            </div>

            {/* Urdu notification */}
            {latestNotification && (
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <p className="text-xs text-slate-600 mb-2">Latest Notification (Urdu)</p>
                <p className="urdu-text text-slate-300 text-base">{latestNotification.message_text_urdu}</p>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "View Full Status", href: "/status", icon: Activity },
              { label: "Notifications", href: "/notifications", icon: Bell },
              { label: "My Card", href: "/card", icon: CreditCard },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="glass-card p-4 flex items-center justify-between group hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-emerald-400 transition-colors" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

