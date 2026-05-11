'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/entropy/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  MessageSquare,
  Send,
  ArrowRight,
  Clock,
  User,
  Loader2,
} from 'lucide-react'
import { rfps } from '@/lib/api'
import type { Proposal, ProposalSection } from '@/lib/types'

// Mock comments — backend doesn't have comments yet
const mockComments = [
  {
    id: '1',
    sectionIdx: 0,
    author: 'Review Team',
    content: 'Please review this section carefully before proceeding.',
    timestamp: new Date().toLocaleString(),
    resolved: false,
  },
]

const getStatusVariant = (status: string): 'success' | 'info' | 'warning' | 'neutral' => {
  switch (status) {
    case 'FINAL': return 'success'
    case 'DRAFT': return 'neutral'
    default: return 'info'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'FINAL': return 'Final'
    case 'DRAFT': return 'Draft'
    default: return status
  }
}

export default function ReviewPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSection, setSelectedSection] = useState<ProposalSection | null>(null)
  const [newComment, setNewComment] = useState('')
  const [updatingOutcome, setUpdatingOutcome] = useState(false)

  useEffect(() => {
    rfps.getProposal(rfpId)
      .then((p) => {
        setProposal(p)
        if (p.sections.length > 0) setSelectedSection(p.sections[0])
      })
      .catch(() => {/* silently fail */})
      .finally(() => setLoading(false))
  }, [rfpId])

  const handleOutcomeUpdate = async (outcome: string) => {
    if (!proposal) return
    setUpdatingOutcome(true)
    try {
      const updated = await rfps.updateOutcome(rfpId, outcome)
      setProposal(updated)
    } catch {/* ignore */} finally {
      setUpdatingOutcome(false)
    }
  }

  const handleContinue = () => {
    router.push(`/rfp/${rfpId}/explorer`)
  }

  const selectedComments = selectedSection
    ? mockComments.filter((_, i) => i === 0)
    : []

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
        <Skeleton className="h-16" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No proposal found. Generate a proposal first.</p>
        <Button className="mt-4" onClick={() => router.push(`/rfp/${rfpId}/proposal`)}>
          Go to Proposal
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sections List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Proposal Sections</CardTitle>
            <CardDescription>
              {proposal.sections.length} sections • Status: {proposal.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {proposal.sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section)}
                  className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${
                    selectedSection?.id === section.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">
                        {direction === 'rtl' ? (section.titleAr || section.titleEn) : (section.titleEn || section.titleAr)}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {section.wordCount} words
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge variant={getStatusVariant(section.isLocked ? 'FINAL' : 'DRAFT')}>
                        {getStatusLabel(section.isLocked ? 'FINAL' : 'DRAFT')}
                      </StatusBadge>
                      {section.isAiGenerated && (
                        <Badge variant="outline" className="text-xs">AI</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comments Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedSection
                    ? (direction === 'rtl' ? (selectedSection.titleAr || selectedSection.titleEn) : (selectedSection.titleEn || selectedSection.titleAr))
                    : 'Select a section'}
                </CardTitle>
                <CardDescription>
                  Review comments and feedback
                </CardDescription>
              </div>
              {selectedSection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOutcomeUpdate('WON')}
                  disabled={updatingOutcome}
                >
                  {updatingOutcome ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Mark as Won
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {selectedSection ? (
              <>
                {/* Section content preview */}
                {(selectedSection.contentEn || selectedSection.contentAr) && (
                  <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground mb-4 max-h-32 overflow-auto">
                    {direction === 'rtl' ? (selectedSection.contentAr || selectedSection.contentEn) : (selectedSection.contentEn || selectedSection.contentAr)}
                  </div>
                )}

                <div className="flex-1 space-y-4 overflow-auto mb-4">
                  {selectedComments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No comments yet</p>
                      <p className="text-sm">Be the first to add a comment</p>
                    </div>
                  ) : (
                    selectedComments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg border ${
                          comment.resolved ? 'bg-muted/30 opacity-60' : 'bg-card'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {comment.author.split(' ').map((n) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{comment.author}</span>
                              <div className="flex items-center gap-2">
                                {comment.resolved && (
                                  <Badge variant="secondary" className="text-xs">
                                    Resolved
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {comment.timestamp}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button disabled={!newComment.trim()}>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Select a section to view comments</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Created: {new Date(proposal.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {proposal.sections.length} sections
          </div>
          {proposal.outcome && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
              Outcome: {proposal.outcome}
            </div>
          )}
        </div>
        <Button onClick={handleContinue}>
          Continue to Explorer
          <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
        </Button>
      </div>
    </div>
  )
}
