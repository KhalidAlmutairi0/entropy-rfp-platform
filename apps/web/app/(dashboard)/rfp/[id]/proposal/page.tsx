'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Save,
  ArrowRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  FileText,
  MessageSquare,
  History,
  Loader2,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { rfps } from '@/lib/api'
import type { Proposal, ProposalSection } from '@/lib/types'

const aiSuggestions = [
  { id: '1', type: 'improve', text: 'Consider adding specific metrics from similar past projects' },
  { id: '2', type: 'expand', text: 'The risk mitigation section could benefit from more detail' },
  { id: '3', type: 'tone', text: 'This paragraph could be more action-oriented' },
]

export default function ProposalPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    rfps.getProposal(rfpId)
      .then((p) => {
        setProposal(p)
        if (p.sections.length > 0) {
          const first = p.sections[0]
          setSelectedSectionId(first.id)
          setContent(first.contentAr || first.contentEn || '')
        }
      })
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes('not found') || err.message.includes('404') || err.message.toLowerCase().includes('no proposal')) {
          setNotFound(true)
        } else {
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))
  }, [rfpId])

  const handleCreateProposal = async () => {
    setCreating(true)
    try {
      const p = await rfps.createProposal(rfpId, 'AI')
      setProposal(p)
      setNotFound(false)
      if (p.sections.length > 0) {
        const first = p.sections[0]
        setSelectedSectionId(first.id)
        setContent(first.contentAr || first.contentEn || '')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal')
    } finally {
      setCreating(false)
    }
  }

  const handleSectionClick = (section: ProposalSection) => {
    setSelectedSectionId(section.id)
    setContent(section.contentAr || section.contentEn || '')
  }

  const handleContinue = () => {
    router.push(`/rfp/${rfpId}/export`)
  }

  const selectedSection = proposal?.sections.find(s => s.id === selectedSectionId)
  const totalWords = proposal?.sections.reduce((acc, s) => acc + s.wordCount, 0) ?? 0

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)]">
        <div className="w-64 border-r p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4 mt-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Proposal Yet</h2>
        <p className="text-muted-foreground">
          A proposal has not been generated for this RFP yet.
        </p>
        <Button onClick={handleCreateProposal} disabled={creating}>
          {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Proposal</>}
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4 mt-12">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  if (!proposal) return null

  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Left Sidebar - Section Navigation */}
      <div className="w-64 border-r flex flex-col bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Proposal Sections</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Total: {totalWords.toLocaleString()} words
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {proposal.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors',
                  selectedSectionId === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium truncate">
                    {direction === 'rtl' ? (section.titleAr || section.titleEn) : (section.titleEn || section.titleAr)}
                  </span>
                  {section.isLocked && (
                    <Lock className={cn('h-3 w-3 shrink-0', selectedSectionId === section.id ? 'opacity-80' : 'text-muted-foreground')} />
                  )}
                </div>
                <span className={cn(
                  'text-xs',
                  selectedSectionId === section.id ? 'opacity-80' : 'text-muted-foreground'
                )}>
                  {section.wordCount} words
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b px-4 py-2 flex items-center justify-between bg-card">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Redo className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Italic className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Quote className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {selectedSection?.isLocked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" className="gap-1">
              <Sparkles className="h-4 w-4" />
              AI Assist
            </Button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 overflow-auto">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-full w-full resize-none border-0 focus-visible:ring-0 text-base leading-relaxed font-sans"
              placeholder="Start writing your proposal..."
              disabled={selectedSection?.isLocked}
            />
          </div>

          {/* Right Panel */}
          <div className="w-80 border-l bg-card flex flex-col">
            <Tabs defaultValue="ai" className="flex-1 flex flex-col">
              <div className="border-b px-2">
                <TabsList className="w-full h-10 bg-transparent">
                  <TabsTrigger value="ai" className="flex-1 gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1 gap-1 text-xs">
                    <MessageSquare className="h-3 w-3" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 gap-1 text-xs">
                    <History className="h-3 w-3" />
                    History
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="ai" className="flex-1 overflow-auto m-0 p-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">AI Suggestions</h4>
                  {aiSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm">{suggestion.text}</p>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" size="sm">
                    Generate More Suggestions
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="flex-1 overflow-auto m-0 p-4">
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                </div>
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-auto m-0 p-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Version History</h4>
                  <div className="space-y-2">
                    {[
                      { version: 'Current', time: 'Now', author: 'You' },
                      { version: 'v1', time: 'Created', author: 'AI Assistant' },
                    ].map((v, i) => (
                      <div
                        key={i}
                        className={cn(
                          'p-3 rounded-lg border cursor-pointer transition-colors',
                          i === 0 ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{v.version}</span>
                          <span className="text-xs text-muted-foreground">{v.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">by {v.author}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t p-4 flex items-center justify-between bg-card">
          <div className="text-sm text-muted-foreground">
            {content.split(/\s+/).filter(Boolean).length} words
          </div>
          <Button onClick={handleContinue}>
            Continue to Export
            <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
          </Button>
        </div>
      </div>
    </div>
  )
}
