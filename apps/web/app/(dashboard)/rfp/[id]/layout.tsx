'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/language-provider'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/entropy/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Cog,
  Scale,
  FileSearch,
  Compass,
  FileText,
  Download,
  Presentation,
  ArrowLeft,
} from 'lucide-react'
import { rfps } from '@/lib/api'
import type { RFP } from '@/lib/types'

const rfpSteps = [
  { key: 'processing', icon: Cog, href: 'processing' },
  { key: 'decision', icon: Scale, href: 'decision' },
  { key: 'review', icon: FileSearch, href: 'review' },
  { key: 'explorer', icon: Compass, href: 'explorer' },
  { key: 'proposal', icon: FileText, href: 'proposal' },
  { key: 'export', icon: Download, href: 'export' },
  { key: 'deck', icon: Presentation, href: 'deck' },
]

const statusVariantMap: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  UPLOADED: 'neutral',
  PROCESSING: 'info',
  DECISION_READY: 'success',
  ACTION_REQUIRED: 'warning',
  PROPOSAL_DRAFT: 'primary',
  PROPOSAL_REVIEW: 'primary',
  PROPOSAL_FINAL: 'success',
  FAILED: 'danger',
}

export default function RfpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t, direction } = useLanguage()
  const params = useParams() as { id: string }
  const pathname = usePathname()
  const currentStep = pathname.split('/').pop()
  const rfpId = params.id

  const [rfp, setRfp] = useState<RFP | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    rfps.get(rfpId)
      .then(setRfp)
      .catch(() => {/* silently fail — show skeleton */})
      .finally(() => setLoading(false))
  }, [rfpId])

  const title = rfp ? (rfp.titleEn || rfp.titleAr || 'Untitled RFP') : null
  const agency = rfp?.agency ?? null
  const status = rfp?.status ?? null
  const statusVariant = status ? (statusVariantMap[status] ?? 'neutral') : 'neutral'
  const statusLabel = status ? status.replace(/_/g, ' ') : 'Loading...'

  return (
    <div className="flex flex-col h-full">
      {/* RFP Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className={cn('h-4 w-4', direction === 'rtl' && 'rotate-180')} />
              </Link>
            </Button>
            <div>
              {loading ? (
                <>
                  <Skeleton className="h-5 w-48 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <h1 className="text-xl font-semibold">{title}</h1>
                  {agency && <p className="text-sm text-muted-foreground">{agency}</p>}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <StatusBadge variant={statusVariant} dot>{statusLabel}</StatusBadge>
            )}
          </div>
        </div>

        {/* Step Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto pb-1">
          {rfpSteps.map((step) => {
            const isActive = currentStep === step.href
            const Icon = step.icon
            return (
              <Link
                key={step.key}
                href={`/rfp/${rfpId}/${step.href}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(`rfp.${step.key}`)}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
