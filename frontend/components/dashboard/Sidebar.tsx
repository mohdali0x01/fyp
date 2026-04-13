"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  Activity,
  Bell,
  CreditCard,
  Network,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard",      icon: LayoutDashboard },
  { label: "Apply for Aid", href: "/apply",          icon: FileText },
  { label: "My Status",     href: "/status",         icon: Activity },
  { label: "Notifications", href: "/notifications",  icon: Bell },
  { label: "My Card",       href: "/card",           icon: CreditCard },
  { label: "Network",       href: "/network",        icon: Network },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col border-r border-slate-800/60 z-40 transition-all duration-300",
        "bg-slate-950/95 backdrop-blur-xl",
        collapsed ? "w-16" : "w-60",
        // Hide on mobile — handled by topbar hamburger
        "hidden lg:flex"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 border-b border-slate-800/60", collapsed ? "justify-center" : "gap-2.5")}>
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base">
            <span className="gradient-text">Aid</span>
            <span className="text-slate-200">Ledger</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                collapsed ? "justify-center" : "",
                active
                  ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-slate-800/60 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-900/50">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user.username}</p>
              <p className="text-xs text-slate-600 capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-all w-full",
            collapsed ? "justify-center" : ""
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
