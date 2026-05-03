"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { StatusPill } from "@/components/status-pill";
import { rfpApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { ArrowRight, Calendar, Building2 } from "lucide-react";

const TABS = [
  { href: "decision",   label: "القرار",          labelEn: "Decision"   },
  { href: "explorer",   label: "استعراض الوثيقة",  labelEn: "Explorer"   },
  { href: "proposal",   label: "المقترح",          labelEn: "Proposal"   },
  { href: "review",     label: "المراجعة",         labelEn: "Review"     },
  { href: "export",     label: "التصدير",          labelEn: "Export"     },
] as const;

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function RFPLayout({ children, params }: LayoutProps) {
  const { id } = use(params);
  const pathname = usePathname();

  const { data } = useSWR(`rfp-${id}`, () => rfpApi.get(id).then((r) => r.data));
  const rfp = data;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-body-sm text-neutral-500" aria-label="Breadcrumb">
          <Link href="/dashboard" className="hover:text-neutral-700 transition-colors">سير الفرص</Link>
          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          <span className="text-neutral-800 font-medium truncate max-w-xs">
            {rfp?.titleAr || rfp?.titleEn || "..."}
          </span>
        </nav>

        {/* RFP Header */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-h2 font-semibold text-neutral-900 leading-snug">
                {rfp?.titleAr || rfp?.titleEn || (
                  <span className="skeleton inline-block w-64 h-6 rounded" />
                )}
              </h1>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {rfp?.agency && (
                  <span className="flex items-center gap-1.5 text-body-sm text-neutral-500">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    {rfp.agency}
                  </span>
                )}
                {rfp?.deadline && (
                  <span className="flex items-center gap-1.5 text-body-sm text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                    {formatDate(rfp.deadline)}
                  </span>
                )}
              </div>
            </div>
            {rfp?.status && <StatusPill status={rfp.status} />}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-1 -mb-px" aria-label="تبويبات المناقصة">
            {TABS.map((tab) => {
              const href = `/rfps/${id}/${tab.href}`;
              const isActive = pathname.endsWith(tab.href) || pathname.includes(`/${tab.href}`);
              return (
                <Link
                  key={tab.href}
                  href={href}
                  className={cn(
                    "px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-primary-600 text-primary-700"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        {children}
      </div>
    </AppShell>
  );
}
