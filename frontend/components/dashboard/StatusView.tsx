"use client";

import { useQuery } from "@tanstack/react-query";
import { registrationApi } from "@/lib/api";
import { PipelineTracker } from "./PipelineTracker";
import {
  PIPELINE_LABELS,
  PIPELINE_DESCRIPTIONS,
  formatDate,
  isFailedStatus,
} from "@/lib/utils";
import type { PipelineStatus } from "@/types";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Hash,
  User,
  MapPin,
  CalendarDays,
  CreditCard,
  FileText,
  Bell,
} from "lucide-react";
import Link from "next/link";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className="text-sm text-slate-300 font-medium">{value}</span>
    </div>
  );
}

export function StatusView() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["status"],
    queryFn: () => registrationApi.getStatus(),
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const app = data?.data?.application;

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex items-center justify-center">
        <div className="flex items-center gap-3 text-emerald-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading status...</span>
        </div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="glass-card p-10 text-center">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-300 mb-2">No Application Found</h3>
        <p className="text-sm text-slate-500 mb-6">You haven&apos;t submitted an application yet.</p>
        <Link href="/apply" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm">
          Apply Now
        </Link>
      </div>
    );
  }

  const status = app.pipeline_status as PipelineStatus;
  const isFailed = isFailedStatus(status);

  return (
    <div className="space-y-5">

      {/* Status header card */}
      <div className={`glass-card p-6 border ${
        status === "ELIGIBLE" ? "border-emerald-500/30" :
        isFailed ? "border-red-500/25" :
        "border-amber-500/25"
      }`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status === "ELIGIBLE" ? "bg-emerald-500/15 animate-glow" :
              isFailed ? "bg-red-500/15" :
              "bg-amber-500/15"
            }`}>
              {status === "ELIGIBLE"
                ? <CheckCircle className="w-6 h-6 text-emerald-400" />
                : isFailed
                ? <XCircle className="w-6 h-6 text-red-400" />
                : <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
              }
            </div>
            <div>
              <div className="font-bold text-slate-200 text-lg">{PIPELINE_LABELS[status]}</div>
              <p className="text-sm text-slate-500 max-w-xs">{PIPELINE_DESCRIPTIONS[status]}</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-all hover:border-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Pipeline tracker */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-300 text-sm mb-6">Verification Steps</h3>
        <PipelineTracker status={status} />
      </div>

      {/* Application details */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Application Details</h3>
        <InfoRow icon={FileText} label="Registration ID" value={`#${app.registration_id}`} />
        <InfoRow icon={User} label="Full Name" value={app.full_name || "—"} />
        <InfoRow icon={CreditCard} label="CNIC" value={`****-***${app.cnic.slice(-4)}`} />
        <InfoRow icon={MapPin} label="City" value={app.city || "—"} />
        <InfoRow icon={CalendarDays} label="Applied On" value={formatDate(app.created_at)} />
        <InfoRow icon={Hash} label="Status" value={status} />
      </div>

      {/* Notifications */}
      {app.notifications && app.notifications.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              Latest Notification
            </h3>
            <Link href="/notifications" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <p className="urdu-text text-slate-200">{app.notifications[0].message_text_urdu}</p>
            <p className="text-xs text-slate-600 mt-3 text-left">{formatDate(app.notifications[0].created_at)}</p>
          </div>
        </div>
      )}

      {/* Card section (if eligible) */}
      {status === "ELIGIBLE" && (
        <div className="glass-card p-6 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">Virtual Aid Card</h3>
              <p className="text-sm text-slate-500">Your card will be issued by a Bank Admin shortly.</p>
            </div>
            <Link href="/card" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 text-sm transition-all">
              <CreditCard className="w-4 h-4" />
              View Card
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
