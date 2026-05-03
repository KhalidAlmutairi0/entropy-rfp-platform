"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusPill } from "@/components/status-pill";
import { rfpApi, analyticsApi } from "@/lib/api";
import { cn, formatDate, truncate, STATUS_LABELS } from "@/lib/utils";
import type { RFP, RFPStatus } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RFPStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, mutate } = useSWR(
    ["rfps", status, search, page],
    () => rfpApi.list({ status: status || undefined, search: search || undefined, page }).then((r) => r.data)
  );

  // Fix B-F3 + B-F4: Fetch real stats from analytics instead of computing from current page slice
  const { data: kpis } = useSWR("analytics-kpis", () => analyticsApi.kpis().then((r) => r.data));

  const rfps: RFP[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const byStatus = kpis?.pipeline?.by_status ?? {};
  const reviewing = (byStatus["analyzing"] ?? 0) + (byStatus["action_required"] ?? 0);
  const decided = byStatus["decision_ready"] ?? 0;
  const drafting = byStatus["drafting"] ?? 0;
  const winRate = kpis?.outcomes?.win_rate != null ? `${kpis.outcomes.win_rate}%` : "—";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-semibold text-neutral-900">سير الفرص</h1>
            <p className="text-body-sm text-neutral-500 mt-1">{total} مناقصة إجمالاً</p>
          </div>
          <Link
            href="/upload"
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold",
              "hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            مناقصة جديدة
          </Link>
        </div>

        {/* Stats row — Fix B-F3 (win rate from API) + B-F4 (totals from analytics not page slice) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "قيد المراجعة",  value: reviewing,  color: "text-warning-700" },
            { label: "قرار جاهز",     value: decided,    color: "text-success-700" },
            { label: "جاري الصياغة",  value: drafting,   color: "text-primary-700" },
            { label: "معدل الفوز",    value: winRate,    color: "text-neutral-700" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
              <p className="text-caption text-neutral-500">{stat.label}</p>
              <p className={cn("text-display font-bold tabular-nums mt-1", stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              placeholder="بحث في المناقصات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-neutral-200 bg-white ps-9 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              aria-label="البحث في المناقصات"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RFPStatus | "")}
            className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            aria-label="فلتر الحالة"
          >
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([key, { ar }]) => (
              <option key={key} value={key}>{ar}</option>
            ))}
          </select>
          <button
            onClick={() => { mutate(); }}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors"
            aria-label="تحديث"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-md" />
              ))}
            </div>
          ) : rfps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-h3 font-semibold text-neutral-700 mb-2">لا توجد مناقصات</p>
              <p className="text-body-sm text-neutral-400 mb-6">
                {search || status ? "لا تتطابق نتائج مع الفلاتر الحالية" : "ارفع أول مناقصة للبدء"}
              </p>
              {!search && !status && (
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  رفع مناقصة
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-start">
                  {["#", "العنوان", "الجهة", "الحالة", "الدرجة", "التحديث", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-medium text-neutral-500 text-caption">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rfps.map((rfp, idx) => (
                  <tr
                    key={rfp.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors cursor-pointer"
                    // Fix B-F12: use Next.js router instead of window.location.href (avoids full page reload)
                    onClick={() => router.push(`/rfps/${rfp.id}/decision`)}
                  >
                    <td className="px-4 py-3 text-neutral-400 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span
                        title={rfp.titleAr || rfp.titleEn || ""}
                        className="font-medium text-neutral-800"
                      >
                        {truncate(rfp.titleAr || rfp.titleEn || "بدون عنوان", 55)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{rfp.agency || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={rfp.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600 tabular-nums">
                      {rfp.fitScore != null ? `${rfp.fitScore}/100` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 tabular-nums">
                      {formatDate(rfp.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/rfps/${rfp.id}/decision`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                        aria-label={`فتح مناقصة ${rfp.titleAr || rfp.titleEn}`}
                      >
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
              <span className="text-caption text-neutral-500">
                صفحة {page} من {data.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 rounded-md border border-neutral-200 text-body-sm hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  السابق
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="h-8 px-3 rounded-md border border-neutral-200 text-body-sm hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
