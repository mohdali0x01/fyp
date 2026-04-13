"use client";

import { useQuery } from "@tanstack/react-query";
import { registrationApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, CreditCard, ShieldCheck, Clock, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";

export function CardView() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => registrationApi.getStatus(),
  });

  const app = data?.data?.application;
  const isEligible = app?.pipeline_status === "ELIGIBLE";

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
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 text-sm mb-4">No application found.</p>
        <Link href="/apply" className="inline-flex gap-2 items-center px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm">Apply Now</Link>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="glass-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="font-semibold text-slate-200">Card Not Yet Issued</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Your virtual aid card will be issued once your application is approved as <strong className="text-emerald-400">ELIGIBLE</strong> and a Bank Admin processes it.
        </p>
        <div className="pt-2">
          <p className="text-xs text-slate-600 mb-1">Current Status</p>
          <span className="badge-pending inline-flex px-3 py-1 rounded-full text-xs font-semibold">
            {app.pipeline_status}
          </span>
        </div>
        <Link href="/status" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Check Status →
        </Link>
      </div>
    );
  }

  // Eligible — show a virtual card UI (card details would come from a card_issue endpoint)
  return (
    <div className="space-y-5">

      {/* Eligibility confirmed banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-sm">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        Your eligibility is confirmed and anchored on Hyperledger Besu.
      </div>

      {/* Virtual card */}
      <div
        className="relative rounded-2xl overflow-hidden p-6 aspect-[1.6/1] flex flex-col justify-between animate-glow"
        style={{
          background: "linear-gradient(135deg, #0a2a1e 0%, #0f3d28 40%, #1a5c3e 100%)",
          border: "1px solid rgba(16,185,129,0.35)",
        }}
      >
        {/* Card bg decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-emerald-400 -translate-y-1/2 translate-x-1/4 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-amber-400 translate-y-1/3 -translate-x-1/4 blur-2xl" />
        </div>

        {/* Top */}
        <div className="flex items-start justify-between relative">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
            <span className="font-bold text-emerald-200 text-sm tracking-wide">AidLedger</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-400/60 font-mono">VIRTUAL AID CARD</div>
            <div className="text-xs text-emerald-400/40 font-mono">PKR</div>
          </div>
        </div>

        {/* Card number placeholder */}
        <div className="relative">
          <div className="font-mono text-base sm:text-xl tracking-widest sm:tracking-[0.25em] text-emerald-200/80">
            **** **** **** ****
          </div>
          <div className="text-xs text-emerald-400/40 font-mono mt-1">Card number issued by Bank Admin</div>
        </div>

        {/* Bottom */}
        <div className="flex items-end justify-between relative">
          <div>
            <div className="text-xs text-emerald-400/50 uppercase tracking-wider mb-0.5">Card Holder</div>
            <div className="text-sm font-semibold text-emerald-200">{app.full_name || user?.username}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-400/50 uppercase tracking-wider mb-0.5">CNIC (masked)</div>
            <div className="font-mono text-sm text-emerald-200">****-***{app.cnic.slice(-4)}</div>
          </div>
        </div>
      </div>

      {/* Card status */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">Card Status</span>
          <span className="badge-pending inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs">
            <Clock className="w-3 h-3" /> Awaiting Bank Issuance
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Your eligibility has been confirmed on the blockchain. A Bank Admin will process your virtual card issuance. Once issued, your card will appear here with a 16-digit number and expiry date.
        </p>
      </div>

      {/* GRC rules */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Spending Rules (On-Chain)
        </h4>
        <div className="space-y-2">
          {[
            ["Max Cash Withdrawal", "PKR 10,000 / transaction"],
            ["Quarterly Spending Cap", "PKR 25,000"],
            ["Card Status", "Active (Post-Issuance)"],
            ["Blockchain Contract", "AidLedgerGov.sol"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm border-b border-slate-800/40 py-2 last:border-0">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-300 font-medium text-xs">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
