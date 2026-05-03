"use client";

import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { KPICard } from "@/components/kpi-card";
import { analyticsApi } from "@/lib/api";
import { cn, formatSAR } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { AlertCircle } from "lucide-react";

const COLORS = ["#486581", "#3b6f9f", "#2d6a4f", "#e76f51", "#f4a261"];

export default function AnalyticsPage() {
  const { data: kpis, isLoading: kpisLoading } = useSWR(
    "kpis",
    () => analyticsApi.kpis().then((r) => r.data)
  );
  const { data: winRateData } = useSWR(
    "win-rate-chart",
    () => analyticsApi.chartWinRateByType().then((r: any) => r.data)
  );
  const { data: decisionsData } = useSWR(
    "decisions-chart",
    () => analyticsApi.chartDecisionsOverTime().then((r: any) => r.data)
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-h1 font-semibold text-neutral-900">التحليلات</h1>
          <p className="text-body-sm text-neutral-500 mt-1">تحليل الأداء ومعدلات الفوز</p>
        </div>

        {/* KPI cards */}
        {kpisLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPICard
              label="معدل الفوز"
              value={`${kpis.winRate?.toFixed(1) ?? 0}%`}
              delta={kpis.winRateDelta}
            />
            <KPICard
              label="إجمالي المناقصات"
              value={kpis.totalRfps}
              delta={kpis.totalRfpsDelta}
            />
            <KPICard
              label="متوسط درجة التأهيل"
              value={kpis.avgFitScore?.toFixed(1) ?? "—"}
              delta={kpis.avgFitScoreDelta}
            />
            <KPICard
              label="قيمة الفرص (ريال)"
              value={formatSAR(kpis.totalPipelineValue ?? 0)}
            />

          </div>
        ) : null}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Decisions over time */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <h2 className="text-h4 font-semibold text-neutral-800 mb-4">القرارات عبر الزمن</h2>
            {decisionsData ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={decisionsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    labelStyle={{ fontWeight: 600 }}
                  />

                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="go"     name="موافقة"  stroke="#2d6a4f" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="review" name="مراجعة"  stroke="#f4a261" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="no_go"  name="رفض"     stroke="#e76f51" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton height={220} />
            )}
          </div>

          {/* Win rate by project type */}
          <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <h2 className="text-h4 font-semibold text-neutral-800 mb-4">معدل الفوز حسب نوع المشروع</h2>
            {winRateData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={winRateData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="projectType" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "معدل الفوز"]}
                  />

                  <Bar dataKey="winRate" name="معدل الفوز" fill="#486581" radius={[4, 4, 0, 0]}>
                    {winRateData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartSkeleton height={220} />
            )}
          </div>
        </div>

        {/* Score distribution */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-h4 font-semibold text-neutral-800 mb-4">توزيع درجات التأهيل</h2>
          {kpis?.scoreDistribution ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={kpis.scoreDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                <Bar dataKey="count" name="عدد المناقصات" fill="#486581" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartSkeleton height={180} />
          )}
        </div>

        {/* Go/No-Go distribution */}
        {kpis?.decisionBreakdown && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "موافقة", key: "go",    color: "#2d6a4f", bg: "bg-success-50 border-success-200" },
              { label: "مراجعة", key: "review", color: "#f4a261", bg: "bg-warning-50 border-warning-200" },
              { label: "رفض",    key: "no_go",  color: "#e76f51", bg: "bg-danger-50 border-danger-200"  },
            ].map(({ label, key, color, bg }) => (
              <div key={key} className={cn("rounded-lg border p-4 text-center", bg)}>
                <p className="text-display font-bold tabular-nums" style={{ color }}>
                  {kpis.decisionBreakdown[key] ?? 0}
                </p>
                <p className="text-body-sm text-neutral-600 mt-1">{label}</p>
                <p className="text-caption text-neutral-500">
                  {kpis.totalRfps > 0
                    ? `${Math.round(((kpis.decisionBreakdown[key] ?? 0) / kpis.totalRfps) * 100)}%`
                    : "0%"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return <div className="skeleton rounded-md" style={{ height }} />;
}
