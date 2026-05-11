'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { useAuth } from '@/contexts/auth-context'
import { rfps as rfpsApi, analytics } from '@/lib/api'
import type { RFP, KpiData } from '@/lib/types'
import { KpiCard } from '@/components/entropy/kpi-card'
import { StatusBadge } from '@/components/entropy/status-badge'
import { DataTable, type Column } from '@/components/entropy/data-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  FileText, TrendingUp, Clock, CheckCircle2,
  Eye, Edit, Trash2, ArrowRight, Calendar,
} from 'lucide-react'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'> = {
  UPLOADED: 'info',
  PROCESSING: 'warning',
  DECISION_READY: 'primary',
  ACTION_REQUIRED: 'danger',
  DRAFTING: 'warning',
  IN_REVIEW: 'primary',
  SUBMITTED: 'info',
  WON: 'success',
  LOST: 'danger',
}

export default function DashboardPage() {
  const { t, direction } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const [rfpList, setRfpList] = useState<RFP[]>([])
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      rfpsApi.list({ pageSize: 20 }),
      analytics.kpis(90),
    ]).then(([rfpData, kpiData]) => {
      setRfpList(rfpData.items)
      setKpis(kpiData)
    }).catch(() => {/* ignore — show empty state */}).finally(() => setLoading(false))
  }, [])

  const columns: Column<RFP>[] = [
    {
      key: 'titleEn',
      header: 'RFP Title',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.titleEn || row.titleAr || 'Untitled'}</p>
          <p className="text-sm text-muted-foreground">{row.agency || '—'}</p>
        </div>
      ),
    },
    {
      key: 'estimatedValueSar',
      header: 'Value',
      cell: (row) => (
        <span className="font-medium">
          {row.estimatedValueSar ? `SAR ${row.estimatedValueSar.toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusBadge variant={STATUS_VARIANT[row.status] ?? 'neutral'} dot>
          {row.status.replace('_', ' ')}
        </StatusBadge>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      cell: (row) => (
        <span className="text-sm">
          {row.deadline ? new Date(row.deadline).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ]

  const handleDelete = async (id: string) => {
    try {
      await rfpsApi.delete(id)
      setRfpList((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const upcomingDeadlines = rfpList
    .filter((r) => r.deadline && new Date(r.deadline) > new Date())
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 3)
    .map((r) => {
      const daysLeft = Math.ceil((new Date(r.deadline!).getTime() - Date.now()) / 86400000)
      return { id: r.id, title: r.titleEn || r.titleAr || 'Untitled', deadline: new Date(r.deadline!).toLocaleDateString(), daysLeft }
    })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.welcome')}, {user?.name?.split(' ')[0] ?? 'User'}</p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <FileText className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {t('nav.upload')}
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <KpiCard title={t('dashboard.totalRfps')} value={String(kpis?.totalRfps ?? 0)} icon={<FileText className="h-4 w-4" />} />
            <KpiCard title={t('dashboard.activeProposals')} value={String(kpis?.activeRfps ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard title={t('dashboard.winRate')} value={`${Math.round((kpis?.winRate ?? 0) * 100)}%`} icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard title={t('dashboard.pendingReview')} value={String(kpis?.reviewCount ?? 0)} icon={<Clock className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('pipeline.title')}</CardTitle>
                <CardDescription>Recent RFPs and proposals</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="gap-1">
                  {t('common.viewAll')}
                  <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={rfpList}
                onRowClick={(row) => router.push(`/rfp/${row.id}/explorer`)}
                searchable={false}
                pageSize={8}
                actions={(row) => (
                  <>
                    <DropdownMenuItem onClick={() => router.push(`/rfp/${row.id}/explorer`)}>
                      <Eye className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} /> View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/rfp/${row.id}/proposal`)}>
                      <Edit className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row.id)}>
                      <Trash2 className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t('dashboard.upcomingDeadlines')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingDeadlines.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
              )}
              {upcomingDeadlines.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.deadline}</p>
                  </div>
                  <StatusBadge variant={item.daysLeft <= 5 ? 'danger' : item.daysLeft <= 10 ? 'warning' : 'neutral'}>
                    {item.daysLeft}d
                  </StatusBadge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {t('dashboard.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rfpList.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{item.status.replace('_', ' ')}</span>
                      {' - '}
                      <span className="text-muted-foreground">{item.titleEn || item.titleAr || 'Untitled'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
