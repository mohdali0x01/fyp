import type { Metadata } from "next";
import { StatusView } from "@/components/dashboard/StatusView";

export const metadata: Metadata = { title: "Application Status" };

export default function StatusPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Application Status</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time verification status with full blockchain audit trail.
        </p>
      </div>
      <StatusView />
    </div>
  );
}
