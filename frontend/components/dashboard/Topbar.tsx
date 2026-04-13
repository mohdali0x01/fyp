"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  Bell,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  FileText,
  Activity,
  CreditCard,
  Network,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard },
  { label: "Apply",         href: "/apply",         icon: FileText },
  { label: "Status",        href: "/status",        icon: Activity },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Card",          href: "/card",          icon: CreditCard },
  { label: "Network",       href: "/network",       icon: Network },
];

export function DashboardTopbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Derive page title from pathname
  const currentPage = NAV_ITEMS.find((n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)));

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        {/* Mobile logo + title */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50" onClick={() => setMenuOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200 text-sm">AidLedger</span>
          </div>
          {/* Desktop page title */}
          <div className="hidden lg:block">
            <h2 className="font-semibold text-slate-200 text-[15px]">{currentPage?.label || "Dashboard"}</h2>
          </div>
        </div>

        {/* Right: user badge */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-2.5 h-2.5 text-emerald-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">{user.username}</span>
          </div>
        )}
      </header>

      {/* Mobile slide-over nav */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200">AidLedger</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      active
                        ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", active ? "text-emerald-400" : "text-slate-600")} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800">
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/8 w-full">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
