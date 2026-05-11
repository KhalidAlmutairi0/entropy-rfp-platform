'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
} from 'lucide-react'
import { rfps } from '@/lib/api'
import type { Decision } from '@/lib/types'

export default function DecisionPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    rfps.decision(rfpId)
      .then(setDecision)
      .catch((err: Error) => {
        const msg = err.message.toLowerCase()
        if (msg.includes('not yet available') || msg.includes('not found') || msg.includes('404')) {
          setNotFound(true)
        } else {
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))
  }, [rfpId])

  const handleProceed = () => {
    router.push(`/rfp/${rfpId}/proposal`)
  }

  const handleDecline = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Loader2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Analysis Not Complete</h2>
        <p className="text-muted-foreground">
          The AI analysis has not been run yet. Please process the RFP first.
        </p>
        <Button onClick={() => router.push(`/rfp/${rfpId}/processing`)}>
          Go to Processing
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Error Loading Decision</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!decision) return null

  const redFlags = decision.flags.filter(f => f.flagType === 'RED')
  const greenFlags = decision.flags.filter(f => f.flagType === 'GREEN')

  const decisionIcon =
    decision.decisionType === 'GO' ? ThumbsUp :
    decision.decisionType === 'NO_GO' ? ThumbsDown :
    Minus

  const decisionColor =
    decision.decisionType === 'GO' ? 'text-[#10B981]' :
    decision.decisionType === 'NO_GO' ? 'text-[#EF4444]' :
    'text-[#F59E0B]'

  const decisionBg =
    decision.decisionType === 'GO' ? 'bg-[#10B981]/10' :
    decision.decisionType === 'NO_GO' ? 'bg-[#EF4444]/10' :
    'bg-[#F59E0B]/10'

  const DecisionIcon = decisionIcon
  const overallScore = Math.round(decision.totalScore)

  // Normalize each dimension to 0–100 for display
  const techPct    = Math.round((decision.technicalFit  / 40) * 100)
  const bizPct     = Math.round((decision.businessFit   / 30) * 100)
  const safetyPct  = Math.round(((30 - decision.riskPenalty) / 30) * 100)
  const confPct    = Math.round(decision.confidence * 100)

  const factors = [
    {
      category: 'Technical Fit',
      label: `${Math.round(decision.technicalFit)} / 40 pts`,
      score: techPct,
      status: techPct >= 65 ? 'positive' : techPct >= 40 ? 'neutral' : 'negative',
    },
    {
      category: 'Business Fit',
      label: `${Math.round(decision.businessFit)} / 30 pts`,
      score: bizPct,
      status: bizPct >= 65 ? 'positive' : bizPct >= 40 ? 'neutral' : 'negative',
    },
    {
      category: 'Safety Score',
      label: decision.riskPenalty === 0 ? 'No risks detected' : `-${Math.round(decision.riskPenalty)} pts deducted`,
      score: safetyPct,
      status: safetyPct >= 75 ? 'positive' : safetyPct >= 50 ? 'neutral' : 'negative',
    },
    {
      category: 'Confidence',
      label: `${confPct}% certainty`,
      score: confPct,
      status: confPct >= 70 ? 'positive' : confPct >= 50 ? 'neutral' : 'negative',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Decision Summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>AI Recommendation</CardTitle>
            <CardDescription>Based on analysis of the RFP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center h-24 w-24 rounded-full ${decisionBg} ${decisionColor} mb-4`}>
                <DecisionIcon className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold">
                {decision.decisionType === 'GO' ? 'Proceed' : decision.decisionType === 'NO_GO' ? 'Decline' : 'Review'}
              </h3>
              <p className="text-muted-foreground">Recommended action</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Score</span>
                <span className="text-sm font-bold">{overallScore}%</span>
              </div>
              <Progress value={overallScore} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                <span>{greenFlags.length} positive {greenFlags.length === 1 ? 'factor' : 'factors'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-[#EF4444]" />
                <span>{redFlags.length} risk {redFlags.length === 1 ? 'factor' : 'factors'}</span>
              </div>
            </div>

            {(decision.explanationEn || decision.explanationAr) && (
              <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                {direction === 'rtl' ? (decision.explanationAr || decision.explanationEn) : (decision.explanationEn || decision.explanationAr)}
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleProceed}>
                Proceed
                <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
              </Button>
              <Button variant="outline" onClick={handleDecline}>
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Decision Factors */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decision Factors</CardTitle>
            <CardDescription>
              Detailed analysis of bid/no-bid criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {factors.map((factor) => (
                <div
                  key={factor.category}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30"
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      factor.status === 'positive'
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : factor.status === 'negative'
                        ? 'bg-[#EF4444]/10 text-[#EF4444]'
                        : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    }`}
                  >
                    {factor.status === 'positive' ? (
                      <ThumbsUp className="h-5 w-5" />
                    ) : factor.status === 'negative' ? (
                      <ThumbsDown className="h-5 w-5" />
                    ) : (
                      <Minus className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h4 className="font-medium">{factor.category}</h4>
                        <p className="text-xs text-muted-foreground">{factor.label}</p>
                      </div>
                      <span className="text-sm font-bold">{factor.score}%</span>
                    </div>
                    <Progress value={factor.score} className="mt-2 h-1.5" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flags */}
      {decision.flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Flags</CardTitle>
            <CardDescription>
              Risk items and positive signals identified in the RFP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Flag</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {decision.flags.map((flag) => (
                    <tr key={flag.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">
                        {direction === 'rtl' ? (flag.titleAr || flag.titleEn) : (flag.titleEn || flag.titleAr)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${flag.flagType === 'RED' ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {flag.flagType === 'RED' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {flag.flagType === 'RED' ? 'Risk' : 'Positive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {direction === 'rtl' ? (flag.descriptionAr || flag.descriptionEn) : (flag.descriptionEn || flag.descriptionAr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
