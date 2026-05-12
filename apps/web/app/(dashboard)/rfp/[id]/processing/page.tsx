'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Brain,
  Search,
  CheckCircle2,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { rfps } from '@/lib/api'

interface ProcessingStep {
  id: string
  title: string
  description: string
  icon: React.ElementType
  status: 'pending' | 'processing' | 'complete'
  progress?: number
}

const INITIAL_STEPS: ProcessingStep[] = [
  {
    id: 'extract',
    title: 'Document Extraction',
    description: 'Extracting text and structure from uploaded documents',
    icon: FileText,
    status: 'processing',
    progress: 0,
  },
  {
    id: 'analyze',
    title: 'AI Analysis',
    description: 'Analyzing requirements, compliance criteria, and key sections',
    icon: Brain,
    status: 'pending',
  },
  {
    id: 'match',
    title: 'Knowledge Matching',
    description: 'Finding relevant content from knowledge base',
    icon: Search,
    status: 'pending',
  },
]

export default function ProcessingPage() {
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS)
  const [isComplete, setIsComplete] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Show extraction completing quickly (it's fast), then hold AI Analysis
  // until polling detects actual completion — no fake "done" timers
  const runStepAnimation = () => {
    const t1 = setTimeout(() => setSteps(prev => prev.map(s => s.id === 'extract' ? { ...s, progress: 50 } : s)), 800)
    const t2 = setTimeout(() => setSteps(prev => prev.map(s => s.id === 'extract' ? { ...s, progress: 100, status: 'complete' } : s)), 3000)
    const t3 = setTimeout(() => setSteps(prev => prev.map(s => s.id === 'analyze' ? { ...s, status: 'processing', progress: 0 } : s)), 3500)
    // AI Analysis stays at "processing" indefinitely — completeAnimation() finishes it
    // Knowledge Matching activates after 20s to reflect the pipeline reaching that step
    const t4 = setTimeout(() => setSteps(prev => prev.map(s => s.id === 'match' ? { ...s, status: 'processing', progress: 0 } : s)), 20000)
    animRef.current = [t1, t2, t3, t4]
  }

  const completeAnimation = () => {
    setSteps([
      { ...INITIAL_STEPS[0], status: 'complete', progress: 100 },
      { ...INITIAL_STEPS[1], status: 'complete', progress: 100 },
      { ...INITIAL_STEPS[2], status: 'complete', progress: 100 },
    ])
    setIsComplete(true)
  }

  useEffect(() => {
    let cancelled = false

    const startAnalysis = async () => {
      try {
        // Kick off analysis
        await rfps.analyze(rfpId)
      } catch {
        // May already be processing — ignore error and proceed to poll
      }

      runStepAnimation()

      // Poll every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const rfp = await rfps.get(rfpId)
          if (cancelled) return

          if (rfp.status === 'DECISION_READY') {
            clearInterval(pollRef.current!)
            completeAnimation()
            setTimeout(() => router.push(`/rfp/${rfpId}/decision`), 1000)
          } else if (rfp.status === 'ACTION_REQUIRED' || rfp.status === 'FAILED') {
            clearInterval(pollRef.current!)
            setHasError(true)
            setErrorMessage('Processing failed. The RFP requires manual review.')
          }
          // Still PROCESSING or UPLOADED — keep polling
        } catch (err: unknown) {
          if (!cancelled) {
            clearInterval(pollRef.current!)
            setHasError(true)
            setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch processing status.')
          }
        }
      }, 3000)
    }

    startAnalysis()

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      animRef.current.forEach(clearTimeout)
    }
  }, [rfpId])

  const handleContinue = () => {
    router.push(`/rfp/${rfpId}/decision`)
  }

  if (hasError) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">Processing Failed</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Processing RFP</h2>
        <p className="text-muted-foreground">
          Please wait while we analyze your RFP documents
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processing Steps</CardTitle>
          <CardDescription>
            {isComplete
              ? 'All processing steps completed successfully'
              : 'Analyzing your documents...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.id} className="flex gap-4">
                <div className="relative">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      step.status === 'complete'
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : step.status === 'processing'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.status === 'complete' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : step.status === 'processing' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute left-1/2 top-10 h-8 w-0.5 -translate-x-1/2 ${
                        step.status === 'complete' ? 'bg-[#10B981]' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  {step.status === 'processing' && step.progress !== undefined && (
                    <Progress value={step.progress} className="mt-2 h-1.5" />
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {isComplete && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleContinue}>
            Continue to Decision
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
