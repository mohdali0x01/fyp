"use client";

import { useQuery } from "@tanstack/react-query";
import { healthApi } from "@/lib/api";
import { Users, CheckCircle, Blocks, Shield } from "lucide-react";

const STATS = [
  { label: "KYC Records", value: "130,000+", sublabel: "Simulated NADRA Dataset", icon: Users, color: "text-emerald-400" },
  { label: "Smart Contracts", value: "2 Live", sublabel: "AidLedgerGov + AidRegistry", icon: Shield, color: "text-blue-400" },
  { label: "Blockchain Nodes", value: "4 Active", sublabel: "Hyperledger Besu Quorum", icon: Blocks, color: "text-amber-400" },
  { label: "Global Budget", value: "350B PKR", sublabel: "On-Chain Governance", icon: CheckCircle, color: "text-purple-400" },
];

export function LandingStats() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: () => healthApi.check(),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 w-full overflow-x-hidden">
      <div className="max-w-5xl mx-auto w-full">
        {/* Backend status pill */}
        <div className="flex justify-center mb-10">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border ${
            data?.data?.status === "OK"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
              : "bg-slate-800 border-slate-700 text-slate-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data?.data?.status === "OK" ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {data?.data?.status === "OK" ? "Backend API: Online" : "Backend API: Connecting..."}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="glass-card p-5 text-center group">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/80 mb-3 ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-100 mb-0.5">{stat.value}</div>
              <div className="text-xs font-medium text-slate-300 mb-1">{stat.label}</div>
              <div className="text-xs text-slate-600">{stat.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
