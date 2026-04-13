"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Blocks, Eye } from "lucide-react";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
      {/* Decorative glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Single centered column — items-center handles positioning, text-center handles text */}
      <div className="max-w-5xl mx-auto w-full flex flex-col items-center text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-xs font-medium mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Powered by Hyperledger Besu — chainId: 1337
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6 animate-slide-up text-center w-full">
          <span className="gradient-text">Transparent Aid.</span>
          <br />
          <span className="text-slate-200">Zero Corruption.</span>
        </h1>

        {/* Sub-headline */}
        <p
          className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-4 leading-relaxed animate-slide-up text-center"
          style={{ animationDelay: "0.1s", opacity: 0 }}
        >
          AidLedger is Pakistan&apos;s first blockchain-enforced GRC framework for aid
          disbursement. Every eligibility decision is anchored on-chain — permanent,
          auditable, and incorruptible.
        </p>

        {/* Urdu tagline */}
        <p
          className="urdu-text text-emerald-400/70 mb-10 animate-fade-in w-full"
          style={{ animationDelay: "0.2s", opacity: 0, textAlign: "center" }}
        >
          شفافیت، احتساب، اور ٹیکنالوجی کے ذریعے امداد کی منصفانہ تقسیم
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up w-full"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          <Link
            href="/signup"
            className="group flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 w-full sm:w-auto"
          >
            Apply for Aid
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/network"
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 font-medium text-sm transition-all hover:bg-emerald-500/5 w-full sm:w-auto"
          >
            <Eye className="w-4 h-4" />
            Live Network
          </Link>
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: ShieldCheck, label: "Immutable Records" },
            { icon: Blocks, label: "4-Node Consensus" },
            { icon: Eye, label: "Full Audit Trail" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-slate-500 text-sm">
              <Icon className="w-4 h-4 text-emerald-500/60" />
              {label}
            </div>
          ))}
        </div>

        {/* Hero blockchain visualization */}
        <div className="mt-16 w-full max-w-3xl">
          <div className="glass-card glow-border p-6 animate-glow">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">Live Blockchain Activity</span>
              <div className="ml-auto text-xs font-mono text-emerald-500/60">Hyperledger Besu</div>
            </div>
            <div className="space-y-2 overflow-x-auto">
              {MOCK_TX.map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/50 min-w-0"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    tx.type === "ELIGIBLE" ? "bg-emerald-400" :
                    tx.type === "KYC" ? "bg-blue-400" : "bg-amber-400"
                  }`} />
                  <span className="font-mono text-xs text-slate-500 w-20 flex-shrink-0">{tx.hash}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                    tx.type === "ELIGIBLE" ? "badge-eligible" :
                    tx.type === "KYC" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                    "badge-pending"
                  }`}>{tx.type}</span>
                  <span className="text-xs text-slate-600 font-mono ml-auto">{tx.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

const MOCK_TX = [
  { hash: "0x4a2f...", type: "ELIGIBLE", time: "2s ago" },
  { hash: "0x8c1e...", type: "KYC",      time: "14s ago" },
  { hash: "0x3b9d...", type: "ELIGIBLE", time: "31s ago" },
  { hash: "0xf72a...", type: "APPLY",    time: "48s ago" },
  { hash: "0x1d6c...", type: "ELIGIBLE", time: "1m ago" },
];
