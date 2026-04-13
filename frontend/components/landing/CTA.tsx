import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-24 w-full overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full text-center">
        <div className="glass-card glow-border p-6 sm:p-12 animate-glow">
          <div className="text-4xl font-bold text-slate-100 mb-4 text-center">
            Ready to apply?
          </div>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-md mx-auto text-center">
            Submit your application in minutes. Your eligibility decision will be
            anchored on the blockchain within seconds — fully transparent and permanent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
            >
              Create Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/network"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300 text-sm font-medium transition-all w-full sm:w-auto justify-center"
            >
              <Network className="w-4 h-4" />
              View Network
            </Link>
          </div>

          {/* Deployed contracts */}
          <div className="mt-10 pt-8 border-t border-slate-800/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "AidLedgerGov", addr: "0x42699A7612A82f1d9C36148af9C77354759b210b" },
              { label: "AidRegistry",  addr: "0xa50a51c09a5c451C52BB714527E1974b686D8e77" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col items-center p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <span className="text-xs text-slate-500 mb-1">{c.label}</span>
                <span className="font-mono text-xs text-emerald-500/70 break-all">{c.addr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
