import Link from "next/link";
import { ShieldCheck, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800/50 bg-slate-950/30 mt-auto w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 overflow-hidden">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-bold text-base">
                <span className="gradient-text">Aid</span>
                <span className="text-slate-200">Ledger</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              A decentralized GRC framework for transparent, blockchain-enforced aid distribution across Pakistan.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2">
              {[
                { label: "Apply for Aid", href: "/signup" },
                { label: "Check Status", href: "/status" },
                { label: "Network Status", href: "/network" },
                { label: "Dashboard", href: "/dashboard" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Technology</h4>
            <div className="space-y-1.5">
              {[
                ["Blockchain", "Hyperledger Besu"],
                ["Smart Contracts", "Solidity"],
                ["Backend", "Node.js + Express"],
                ["Database", "PostgreSQL"],
                ["Network", "4-Node Quorum"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-600">{label}</span>
                  <span className="text-xs text-emerald-500/70 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} AidLedger — Final Year Project. Built on Hyperledger Besu (chainId: 1337).
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Blockchain: Live</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
