"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Upload, BookOpen, FileText, BarChart2,
  Settings, Shield, Bell, ChevronLeft, ChevronRight,
  LogOut, User, Moon, Sun, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  labelEn: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",        label: "سير الفرص",       labelEn: "Pipeline",        icon: LayoutDashboard },
  { href: "/upload",           label: "رفع مناقصة",       labelEn: "Upload RFP",      icon: Upload },
  { href: "/proposals/direct", label: "مقترح مباشر",      labelEn: "Direct Proposal", icon: FileText },
  { href: "/knowledge",        label: "قاعدة المعرفة",     labelEn: "Knowledge Base",  icon: BookOpen },
  { href: "/templates",        label: "القوالب",           labelEn: "Templates",       icon: FileText },
  { href: "/analytics",        label: "التحليلات",         labelEn: "Analytics",       icon: BarChart2 },
  { href: "/settings",         label: "الإعدادات",         labelEn: "Settings",        icon: Settings },
  { href: "/admin",            label: "الإدارة",           labelEn: "Admin",           icon: Shield, adminOnly: true },
];

interface AppShellProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
  notificationCount?: number;
}

export function AppShell({ children, userRole = "PRE_SALES", userName = "المستخدم", notificationCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "g") {
        // Sequence shortcuts handled separately
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isAdmin = userRole === "ADMIN";
  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col h-full border-e border-neutral-200 dark:border-neutral-700 bg-[var(--color-surface)] transition-all duration-200 shrink-0",
          "hidden md:flex",
          collapsed ? "w-16" : "w-60"
        )}
        aria-label="القائمة الجانبية"
      >
        {/* Logo */}
        <div className={cn("flex items-center h-14 px-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0", collapsed && "justify-center")}>
          {!collapsed && (
            <span className="text-h4 font-bold text-primary-700 tracking-tight">Entropy</span>
          )}
          {collapsed && (
            <span className="text-h3 font-bold text-primary-700">E</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="التنقل الرئيسي">
          <ul className="space-y-0.5">
            {visibleNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-600" : "text-neutral-400")} aria-hidden />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pb-3 border-t border-neutral-200 dark:border-neutral-700 pt-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between px-4 shrink-0 bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100"
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            {/* Global search */}
            <div className="relative hidden sm:block">
              <input
                id="global-search"
                type="search"
                placeholder="بحث... (/)"
                className="h-8 w-64 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-body-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                aria-label="البحث العام"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
              aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}
            >
              {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>

            {/* Notifications bell */}
            <Link
              href="/notifications"
              className="relative p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
              aria-label={`${notificationCount} إشعارات غير مقروءة`}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 h-4 w-4 bg-danger-500 text-white text-micro rounded-full flex items-center justify-center font-medium" aria-hidden>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="flex items-center gap-2 ps-2 border-s border-neutral-200">
              <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center" aria-hidden>
                <User className="h-4 w-4 text-primary-600" />
              </div>
              {!collapsed && (
                <span className="text-body-sm font-medium text-neutral-700 hidden sm:block">{userName}</span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
