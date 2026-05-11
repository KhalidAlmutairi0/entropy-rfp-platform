'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  FileText,
  Tag,
  ArrowRight,
  BookOpen,
  Lightbulb,
  ChevronRight,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { rfps } from '@/lib/api'
import type { RFP, Decision, Flag } from '@/lib/types'

export default function ExplorerPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [rfp, setRfp] = useState<RFP | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rfpData, decisionData] = await Promise.allSettled([
          rfps.get(rfpId),
          rfps.decision(rfpId),
        ])
        if (rfpData.status === 'fulfilled') setRfp(rfpData.value)
        if (decisionData.status === 'fulfilled') setDecision(decisionData.value)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [rfpId])

  const handleContinue = () => {
    router.push(`/rfp/${rfpId}/proposal`)
  }

  const redFlags = decision?.flags.filter(f => f.flagType === 'RED') ?? []
  const greenFlags = decision?.flags.filter(f => f.flagType === 'GREEN') ?? []

  const filteredFiles = (rfp?.files ?? []).filter(f =>
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)]">
        <div className="w-80 border-r p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Left Panel - Files */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-2">Document Files</h3>
          <div className="relative">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-muted/50 border-0 ${direction === 'rtl' ? 'pr-9' : 'pl-9'}`}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No files found</p>
            ) : (
              filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFile === file.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm truncate">{file.filename}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-60">{file.fileType.toUpperCase()}</span>
                    <span className="text-xs opacity-60">{formatBytes(file.sizeBytes)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="overview" className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="overview" className="gap-2">
                <FileText className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="requirements" className="gap-2">
                <Tag className="h-4 w-4" />
                Risk Flags
              </TabsTrigger>
              <TabsTrigger value="positive" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Positive Flags
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                AI Insights
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="flex-1 overflow-auto p-4 m-0">
            {rfp ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{rfp.titleEn || rfp.titleAr || 'Untitled RFP'}</CardTitle>
                    {rfp.agency && <CardDescription>{rfp.agency}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {rfp.tenderNumber && (
                        <div>
                          <p className="text-muted-foreground">Tender Number</p>
                          <p className="font-medium">{rfp.tenderNumber}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Language</p>
                        <p className="font-medium">{rfp.language}</p>
                      </div>
                      {rfp.deadline && (
                        <div>
                          <p className="text-muted-foreground">Deadline</p>
                          <p className="font-medium">{new Date(rfp.deadline).toLocaleDateString()}</p>
                        </div>
                      )}
                      {rfp.estimatedValueSar != null && (
                        <div>
                          <p className="text-muted-foreground">Estimated Value</p>
                          <p className="font-medium">SAR {rfp.estimatedValueSar.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-[#EF4444]" />
                        <div>
                          <p className="text-2xl font-bold">{redFlags.length}</p>
                          <p className="text-sm text-muted-foreground">Risk Flags</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                        <div>
                          <p className="text-2xl font-bold">{greenFlags.length}</p>
                          <p className="text-sm text-muted-foreground">Positive Signals</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Unable to load RFP data.</p>
            )}
          </TabsContent>

          <TabsContent value="requirements" className="flex-1 overflow-auto p-4 m-0">
            <div className="space-y-3">
              {redFlags.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No risk flags identified</p>
                </div>
              ) : (
                redFlags.map((flag: Flag, idx: number) => (
                  <Card key={flag.id} className="hover:border-destructive/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-sm font-medium shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {direction === 'rtl' ? (flag.titleAr || flag.titleEn) : (flag.titleEn || flag.titleAr)}
                          </p>
                          {(flag.descriptionEn || flag.descriptionAr) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {direction === 'rtl' ? (flag.descriptionAr || flag.descriptionEn) : (flag.descriptionEn || flag.descriptionAr)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {flag.severity && (
                              <Badge variant="destructive" className="text-xs">{flag.severity}</Badge>
                            )}
                            {flag.sectionName && (
                              <Badge variant="outline" className="text-xs">{flag.sectionName}</Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="positive" className="flex-1 overflow-auto p-4 m-0">
            <div className="space-y-3">
              {greenFlags.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No positive flags identified</p>
                </div>
              ) : (
                greenFlags.map((flag: Flag, idx: number) => (
                  <Card key={flag.id} className="hover:border-[#10B981]/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] text-sm font-medium shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {direction === 'rtl' ? (flag.titleAr || flag.titleEn) : (flag.titleEn || flag.titleAr)}
                          </p>
                          {(flag.descriptionEn || flag.descriptionAr) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {direction === 'rtl' ? (flag.descriptionAr || flag.descriptionEn) : (flag.descriptionEn || flag.descriptionAr)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="flex-1 overflow-auto p-4 m-0">
            <div className="space-y-4">
              {decision?.explanationEn && (
                <Card className="border-[#3B82F6]/50 bg-[#3B82F6]/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6] shrink-0">
                        <Lightbulb className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[#3B82F6]">AI Analysis (English)</h4>
                        <p className="text-sm text-muted-foreground mt-1">{decision.explanationEn}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {decision?.explanationAr && (
                <Card className="border-[#10B981]/50 bg-[#10B981]/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center text-[#10B981] shrink-0">
                        <Lightbulb className="h-4 w-4" />
                      </div>
                      <div dir="rtl">
                        <h4 className="font-medium text-[#10B981]">التحليل بالعربية</h4>
                        <p className="text-sm text-muted-foreground mt-1">{decision.explanationAr}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!decision && (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI insights available yet. Process the RFP first.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom Action Bar */}
        <div className="border-t p-4 flex items-center justify-between bg-card">
          <div className="text-sm text-muted-foreground">
            {redFlags.length} risk flags • {greenFlags.length} positive matches
          </div>
          <Button onClick={handleContinue}>
            Start Proposal
            <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
          </Button>
        </div>
      </div>
    </div>
  )
}
