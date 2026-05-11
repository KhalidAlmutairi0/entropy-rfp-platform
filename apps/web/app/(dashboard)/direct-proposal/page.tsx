'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Sparkles,
  Send,
  Save,
  Copy,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { proposals, templates as templatesApi } from '@/lib/api'
import type { Template, Proposal } from '@/lib/types'

export default function DirectProposalPage() {
  const { t, direction } = useLanguage()
  const router = useRouter()

  const [templateList, setTemplateList] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  const [title, setTitle] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [createdProposal, setCreatedProposal] = useState<Proposal | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    templatesApi.list()
      .then(res => setTemplateList(res.items))
      .catch(() => {/* ignore */})
      .finally(() => setLoadingTemplates(false))
  }, [])

  const handleGenerate = async () => {
    if (!title.trim()) return
    setIsGenerating(true)
    setError('')
    try {
      const p = await proposals.createDirect({
        title: title.trim(),
        useAiAgenda: true,
        templateId: selectedTemplateId || undefined,
      })
      setCreatedProposal(p)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleNavigate = () => {
    if (createdProposal?.rfpId) {
      router.push(`/rfp/${createdProposal.rfpId}/proposal`)
    }
  }

  const generatedContent = createdProposal
    ? createdProposal.sections
        .map(s => `# ${s.titleEn || s.titleAr || 'Section'}\n\n${s.contentEn || s.contentAr || ''}`)
        .join('\n\n---\n\n')
    : ''

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('nav.directProposal')}</h1>
        <p className="text-muted-foreground">
          Create proposals directly without uploading an RFP document
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Details</CardTitle>
              <CardDescription>
                Provide information about the proposal you want to create
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Cloud Infrastructure Modernization"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder={loadingTemplates ? 'Loading templates...' : 'Select a template (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.nameEn || tpl.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Context</CardTitle>
              <CardDescription>
                Add any additional information to help generate a better proposal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="strengths">Our Strengths</Label>
                <Textarea
                  id="strengths"
                  placeholder="What makes your company uniquely qualified..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="differentiators">Key Differentiators</Label>
                <Textarea
                  id="differentiators"
                  placeholder="What sets your approach apart from competitors..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating || !title.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Proposal...
              </>
            ) : (
              <>
                <Sparkles className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                Generate Proposal
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Proposal</CardTitle>
                  <CardDescription>
                    AI-generated proposal based on your inputs
                  </CardDescription>
                </div>
                {generatedContent && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard?.writeText(generatedContent)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {generatedContent ? (
                <Tabs defaultValue="preview" className="h-full flex flex-col">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {generatedContent}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="edit" className="flex-1 mt-4">
                    <Textarea
                      value={generatedContent}
                      className="h-full min-h-[400px] font-mono text-sm"
                      readOnly
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    Fill in the details and click &quot;Generate Proposal&quot; to create your proposal
                  </p>
                </div>
              )}
            </CardContent>
            {createdProposal && (
              <div className="p-4 border-t flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                  Generated successfully
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline">
                    <Save className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    Save Draft
                  </Button>
                  {createdProposal.rfpId && (
                    <Button onClick={handleNavigate}>
                      <Send className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                      Open Proposal
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
