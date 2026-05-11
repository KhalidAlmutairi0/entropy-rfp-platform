"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/components/providers/language-provider"
import {
  Target,
  FileText,
  DollarSign,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react"
import { analytics } from "@/lib/api"
import type { KpiData, ChartPoint } from "@/lib/types"

const DAYS_MAP: Record<string, number> = {
  '30days': 30,
  '3months': 90,
  '6months': 180,
  '1year': 365,
}

export default function AnalyticsPage() {
  const { t, direction: dir } = useLanguage()
  const [timeRange, setTimeRange] = useState("6months")
  const [activeTab, setActiveTab] = useState("overview")

  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)

  useEffect(() => {
    const days = DAYS_MAP[timeRange] ?? 90
    setLoadingKpis(true)
    setLoadingChart(true)

    analytics.kpis(days)
      .then(setKpis)
      .catch(() => {/* ignore */})
      .finally(() => setLoadingKpis(false))

    analytics.decisionsOverTime(days)
      .then((res) => setChartData(res.rows))
      .catch(() => setChartData([]))
      .finally(() => setLoadingChart(false))
  }, [timeRange])

  const kpiCards = kpis
    ? [
        {
          key: "total_rfps",
          value: String(kpis.totalRfps),
          label: "Total RFPs",
          icon: FileText,
          color: "text-blue-600",
          trend: "up" as const,
          change: `${kpis.activeRfps} active`,
        },
        {
          key: "win_rate",
          value: `${Math.round(kpis.winRate * 100)}%`,
          label: "Win Rate",
          icon: Target,
          color: "text-green-600",
          trend: "up" as const,
          change: `${kpis.goCount} go decisions`,
        },
        {
          key: "decisions",
          value: String(kpis.decisions),
          label: "Total Decisions",
          icon: BarChart3,
          color: "text-orange-600",
          trend: "up" as const,
          change: `${kpis.decisionReady} ready`,
        },
        {
          key: "go_vs_nogo",
          value: `${kpis.goCount}/${kpis.noGoCount}`,
          label: "GO / NO-GO",
          icon: DollarSign,
          color: "text-purple-600",
          trend: kpis.goCount >= kpis.noGoCount ? ("up" as const) : ("down" as const),
          change: `${kpis.reviewCount} in review`,
        },
      ]
    : null

  return (
    <div className="flex flex-col gap-6 p-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("analytics")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("analytics_description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 me-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 me-2" />
            {t("export")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingKpis
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : kpiCards?.map((kpi) => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.key}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className={`flex items-center gap-1 text-sm ${
                        kpi.trend === "up" ? "text-green-600" : "text-red-600"
                      }`}>
                        {kpi.trend === "up" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {kpi.change}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-2xl font-semibold text-foreground">{kpi.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-2">
            <PieChart className="h-4 w-4" />
            Decisions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Decisions Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decisions Over Time</CardTitle>
                <CardDescription>GO / REVIEW / NO-GO breakdown by period</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingChart ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    No data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chartData.map((point) => {
                      const total = point.count || 1
                      const goCount = point.goCount ?? 0
                      const reviewCount = point.reviewCount ?? 0
                      const noGoCount = point.noGoCount ?? 0
                      return (
                        <div key={point.period} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{point.period}</span>
                            <span className="text-muted-foreground">{total} decisions</span>
                          </div>
                          <div className="flex gap-1 h-2">
                            <div
                              className="bg-[#10B981] rounded-s-sm"
                              style={{ width: `${(goCount / total) * 100}%` }}
                            />
                            <div
                              className="bg-[#F59E0B]"
                              style={{ width: `${(reviewCount / total) * 100}%` }}
                            />
                            <div
                              className="bg-[#EF4444] rounded-e-sm"
                              style={{ width: `${(noGoCount / total) * 100}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
                              GO: {goCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B]" />
                              Review: {reviewCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-[#EF4444]" />
                              NO-GO: {noGoCount}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decision Summary</CardTitle>
                <CardDescription>Overall decision distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingKpis || !kpis ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: 'GO', count: kpis.goCount, color: 'bg-[#10B981]', total: kpis.decisions },
                      { label: 'REVIEW', count: kpis.reviewCount, color: 'bg-[#F59E0B]', total: kpis.decisions },
                      { label: 'NO-GO', count: kpis.noGoCount, color: 'bg-[#EF4444]', total: kpis.decisions },
                    ].map((item) => {
                      const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0
                      return (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-3 h-3 rounded-full ${item.color}`} />
                              <span className="font-medium">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{item.count}</Badge>
                              <span className="text-muted-foreground">{pct}%</span>
                            </div>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision Breakdown</CardTitle>
              <CardDescription>Detailed breakdown by decision type</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingKpis || !kpis ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="p-6 rounded-lg bg-[#10B981]/10">
                    <p className="text-4xl font-bold text-[#10B981]">{kpis.goCount}</p>
                    <p className="text-sm font-medium mt-2">GO</p>
                    <p className="text-xs text-muted-foreground mt-1">Bid decisions</p>
                  </div>
                  <div className="p-6 rounded-lg bg-[#F59E0B]/10">
                    <p className="text-4xl font-bold text-[#F59E0B]">{kpis.reviewCount}</p>
                    <p className="text-sm font-medium mt-2">REVIEW</p>
                    <p className="text-xs text-muted-foreground mt-1">Needs review</p>
                  </div>
                  <div className="p-6 rounded-lg bg-[#EF4444]/10">
                    <p className="text-4xl font-bold text-[#EF4444]">{kpis.noGoCount}</p>
                    <p className="text-sm font-medium mt-2">NO-GO</p>
                    <p className="text-xs text-muted-foreground mt-1">Declined</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
