'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Presentation,
  Maximize2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { rfps } from '@/lib/api'
import type { RFP } from '@/lib/types'

export default function DeckPage() {
  const { direction } = useLanguage()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [rfp, setRfp] = useState<RFP | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const deckStatus = rfp?.deckStatus

  useEffect(() => {
    rfps.get(rfpId)
      .then(setRfp)
      .catch(() => {/* silently fail */})
      .finally(() => setLoading(false))
  }, [rfpId])

  // Poll while deck is PENDING or GENERATING
  useEffect(() => {
    if (!deckStatus || (deckStatus !== 'PENDING' && deckStatus !== 'GENERATING')) return

    pollRef.current = setInterval(async () => {
      try {
        const updated = await rfps.get(rfpId)
        setRfp(updated)
        if (updated.deckStatus !== 'PENDING' && updated.deckStatus !== 'GENERATING') {
          clearInterval(pollRef.current!)
        }
      } catch {/* ignore */}
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [deckStatus, rfpId])

  const handleGenerateDeck = async () => {
    setGenerating(true)
    try {
      await rfps.generateDeck(rfpId)
      // Refresh RFP to get updated deckStatus
      const updated = await rfps.get(rfpId)
      setRfp(updated)
    } catch {/* ignore */} finally {
      setGenerating(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await rfps.downloadDeck(rfpId)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deck-${rfpId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {/* ignore */} finally {
      setDownloading(false)
    }
  }

  // Placeholder slides for preview structure
  const placeholderSlides = [
    { id: '1', title: 'Title Slide', label: 'Title' },
    { id: '2', title: 'Executive Summary', label: 'Summary' },
    { id: '3', title: 'Our Approach', label: 'Approach' },
    { id: '4', title: 'Why Choose Us', label: 'Value Prop' },
    { id: '5', title: 'Investment', label: 'Pricing' },
    { id: '6', title: 'Next Steps', label: 'Next Steps' },
  ]

  const handlePrevSlide = () => setCurrentSlide(prev => Math.max(0, prev - 1))
  const handleNextSlide = () => setCurrentSlide(prev => Math.min(placeholderSlides.length - 1, prev + 1))

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // PENDING or GENERATING
  if (deckStatus === 'PENDING' || deckStatus === 'GENERATING') {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Generating Deck</h2>
          <p className="text-muted-foreground">Your presentation deck is being generated...</p>
        </div>
      </div>
    )
  }

  // FAILED
  if (deckStatus === 'FAILED') {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Generation Failed</h2>
          <p className="text-muted-foreground">There was an error generating your deck.</p>
          <Button onClick={handleGenerateDeck} disabled={generating}>
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Retrying...</> : <><RefreshCw className="h-4 w-4 mr-2" />Retry</>}
          </Button>
        </div>
      </div>
    )
  }

  // READY — show download button prominently
  if (deckStatus === 'READY') {
    return (
      <div className="flex h-[calc(100vh-10rem)]">
        {/* Slide Thumbnails */}
        <div className="w-48 border-r bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Slides</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {placeholderSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(index)}
                  className="w-full group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground pt-1 w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className={cn(
                        'aspect-video rounded-lg border-2 bg-card flex items-center justify-center p-2 transition-all',
                        index === currentSlide ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                      )}>
                        <p className="text-[8px] font-medium">{slide.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate px-1">{slide.title}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col">
          <div className="border-b px-4 py-2 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm"><Copy className="h-4 w-4 mr-1" />Duplicate</Button>
              <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                Ready
              </Badge>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-1" />
                AI Enhance
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Download Deck
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
            <Card className="w-full max-w-4xl aspect-video shadow-lg">
              <CardContent className="h-full p-8 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-16 w-16 text-[#10B981] mb-4" />
                <h2 className="text-2xl font-bold">Deck Ready</h2>
                <p className="text-muted-foreground mt-2">
                  {rfp?.titleEn || rfp?.titleAr || 'Your presentation deck is ready to download'}
                </p>
                <Button className="mt-6" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downloading...</> : <><Download className="h-4 w-4 mr-2" />Download PDF</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="border-t px-4 py-3 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevSlide} disabled={currentSlide === 0}>
                <ChevronLeft className={cn('h-4 w-4', direction === 'rtl' && 'rotate-180')} />
              </Button>
              <span className="text-sm px-2">{currentSlide + 1} / {placeholderSlides.length}</span>
              <Button variant="outline" size="icon" onClick={handleNextSlide} disabled={currentSlide === placeholderSlides.length - 1}>
                <ChevronRight className={cn('h-4 w-4', direction === 'rtl' && 'rotate-180')} />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Presentation className="h-3 w-3 mr-1" />
                {placeholderSlides.length} slides
              </Badge>
              <Button variant="ghost" size="icon">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No deck yet (deckStatus is undefined/null)
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Presentation className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Deck Generated</h2>
        <p className="text-muted-foreground">
          Generate a presentation deck from this proposal.
        </p>
        <Button onClick={handleGenerateDeck} disabled={generating}>
          {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Deck</>}
        </Button>
      </div>
    </div>
  )
}
