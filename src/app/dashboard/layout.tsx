"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  FileText,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  
  const [theme, setTheme] = useState({ color: 'indigo', density: 'cozy' });

  useEffect(() => {
    supabase.from('businesses').select('theme_color, ui_density').single().then(({ data }) => {
      if (data) setTheme({ color: data.theme_color || 'indigo', density: data.ui_density || 'cozy' });
    });
  }, [supabase]);

  const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Invoices", href: "/dashboard/invoices", icon: FileText },
    { name: "Approval Queue", href: "/dashboard/queue", icon: CheckCircle2 },
    { name: "Needs Attention", href: "/dashboard/attention", icon: AlertCircle },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased selection:bg-blue-500 selection:text-white theme-${theme.color} density-${theme.density}`}>
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950/95 backdrop-blur-xl text-slate-200 border-r border-slate-800 flex flex-col flex-shrink-0 relative z-20 shadow-2xl">
        {/* Brand header */}
        <div className="h-18 px-6 flex items-center justify-between border-b border-slate-800/80">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight block">InvoiceNudge</span>
              <span className="text-[10px] text-blue-400 font-medium tracking-wide uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                AI Active
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Workspace
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "text-white bg-slate-900 shadow-inner border border-slate-800/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPip"
                    className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`mr-3 h-4 w-4 transition-colors duration-200 ${
                    isActive
                      ? "text-blue-400"
                      : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <span className="flex-1">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom card & sign out */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-3.5 rounded-xl border border-slate-800/80 shadow-sm text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Auto-Pilot Mode
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 font-mono">MVP</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Approval queue active. The agent will draft messages for your confirmation.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-3 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-rose-950/30 hover:text-rose-300 transition-colors duration-150 group"
          >
            <LogOut
              className="mr-2.5 h-3.5 w-3.5 text-slate-500 group-hover:text-rose-400 transition-colors"
            />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/70 text-slate-900 relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto text-slate-900 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
