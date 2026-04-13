"use client";

import { useQuery } from "@tanstack/react-query";
import { registrationApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Bell, Loader2, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import Link from "next/link";

function getNotificationIcon(message: string) {
  if (message.includes("مبارک") || message.includes("کامیابی")) {
    return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  }
  if (message.includes("مسترد")) {
    return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  }
  return <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />;
}

export function NotificationsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => registrationApi.getStatus(),
  });

  const app = data?.data?.application;
  const notifications = app?.notifications || [];

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="glass-card p-10 text-center">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-500 text-sm">No application found.</p>
        <Link href="/apply" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm">Apply Now</Link>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <Bell className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 font-medium mb-1">No notifications yet</p>
        <p className="text-slate-600 text-sm">Notifications will appear here as your application progresses through the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((n, i) => (
        <div key={i} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            {getNotificationIcon(n.message_text_urdu)}
            <span className="text-xs text-slate-500">{formatDate(n.created_at)}</span>
            {i === 0 && (
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full badge-pending">Latest</span>
            )}
          </div>
          <p className="urdu-text text-slate-200 text-lg">{n.message_text_urdu}</p>
        </div>
      ))}

      <div className="text-center pt-4">
        <p className="text-xs text-slate-600">
          All notifications are generated automatically by the verification pipeline.
        </p>
      </div>
    </div>
  );
}
