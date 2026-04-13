"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { ShieldCheck, Menu, X, LogOut, LayoutDashboard, Network, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/30"
      style={{ background: "rgba(8,15,26,0.92)", backdropFilter: "blur(16px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="gradient-text">Aid</span>
              <span className="text-slate-200">Ledger</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/network" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5" />
              Network
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 ml-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <User className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-300 font-medium">{user?.username}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition-all hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  Apply for Aid
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-3">
            <Link href="/network" className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 py-2" onClick={() => setMenuOpen(false)}>
              <Network className="w-4 h-4" /> Network
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 py-2" onClick={() => setMenuOpen(false)}>
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="flex items-center gap-2 text-sm text-red-400 py-2 w-full">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="block text-sm text-slate-400 hover:text-slate-200 py-2" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/signup" className="block text-sm font-medium py-2 text-center rounded-lg bg-emerald-500 text-slate-900 hover:bg-emerald-400 transition-all" onClick={() => setMenuOpen(false)}>
                  Apply for Aid
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
