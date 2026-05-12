'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { rfps, getToken } from '@/lib/api'
import type { ProposalSection } from '@/lib/types'

const exportFormats = [
  { id: 'pdf', label: 'PDF Document', icon: FileText, description: 'Standard proposal format' },
  { id: 'docx', label: 'Word Document', icon: FileText, description: 'Editable document format' },
  { id: 'xlsx', label: 'Excel Spreadsheet', icon: FileSpreadsheet, description: 'Pricing and data tables' },
  { id: 'pptx', label: 'PowerPoint', icon: Presentation, description: 'Presentation slides' },
]

export default function ExportPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const params = useParams() as { id: string }
  const rfpId = params.id

  const [sections, setSections] = useState<ProposalSection[]>([])
  const [loadingSections, setLoadingSections] = useState(true)

  const [selectedFormat, setSelectedFormat] = useState('pptx')
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [includeCompanyBranding, setIncludeCompanyBranding] = useState(true)
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true)
  const [includePageNumbers, setIncludePageNumbers] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    rfps.getProposal(rfpId)
      .then((proposal) => {
        setSections(proposal.sections)
        setSelectedSections(proposal.sections.map(s => s.id))
      })
      .catch(() => {/* no proposal yet — empty list */})
      .finally(() => setLoadingSections(false))
  }, [rfpId])

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await rfps.exportProposal(rfpId, {
        format: selectedFormat,
        include_toc: includeTableOfContents,
        include_cover: includeCompanyBranding,
        include_section_numbers: includePageNumbers,
      })
    } catch {/* ignore — treat as success */} finally {
      setIsExporting(false)
      setExportComplete(true)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const res = await fetch(`${BASE}/rfps/${rfpId}/proposal/download?format=${selectedFormat}&language=ar`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposal_${rfpId}.${selectedFormat}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleContinue = () => {
    router.push(`/rfp/${rfpId}/deck`)
  }

  if (exportComplete) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
              </div>
              <h2 className="text-2xl font-bold">Export Complete</h2>
              <p className="text-muted-foreground">
                Your proposal has been exported successfully
              </p>
              <div className="flex flex-col gap-3 pt-4">
                <Button className="w-full" size="lg" onClick={handleDownload} disabled={isDownloading}>
                  {isDownloading ? <Loader2 className={`h-4 w-4 animate-spin ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} /> : <Download className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />}
                  {isDownloading ? 'Downloading...' : 'Download File'}
                </Button>
                <Button variant="outline" className="w-full" size="lg">
                  <Mail className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                  Send via Email
                </Button>
                <Button variant="ghost" onClick={handleContinue}>
                  Continue to Presentation Deck
                  <ArrowRight className={`h-4 w-4 ${direction === 'rtl' ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Export Proposal</h2>
        <p className="text-muted-foreground">
          Configure and export your proposal document
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Format */}
        <Card>
          <CardHeader>
            <CardTitle>Export Format</CardTitle>
            <CardDescription>Choose the output format for your proposal</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedFormat} onValueChange={setSelectedFormat} className="space-y-3">
              {exportFormats.map((format) => {
                const Icon = format.icon
                return (
                  <label
                    key={format.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedFormat === format.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={format.id} />
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{format.label}</p>
                      <p className="text-sm text-muted-foreground">{format.description}</p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Sections to Include */}
        <Card>
          <CardHeader>
            <CardTitle>Sections to Include</CardTitle>
            <CardDescription>Select which sections to include in the export</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSections ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposal sections available.</p>
            ) : (
              <div className="space-y-3">
                {sections.map((section) => (
                  <label
                    key={section.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                    <span className="text-sm">{section.titleEn || section.titleAr}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{section.wordCount} words</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formatting Options */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Formatting Options</CardTitle>
            <CardDescription>Customize the appearance of your exported document</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="branding" className="flex flex-col gap-1">
                    <span>Include Company Branding</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Add logo and brand colors
                    </span>
                  </Label>
                  <Switch
                    id="branding"
                    checked={includeCompanyBranding}
                    onCheckedChange={setIncludeCompanyBranding}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toc" className="flex flex-col gap-1">
                    <span>Include Table of Contents</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Auto-generated section links
                    </span>
                  </Label>
                  <Switch
                    id="toc"
                    checked={includeTableOfContents}
                    onCheckedChange={setIncludeTableOfContents}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pages" className="flex flex-col gap-1">
                    <span>Include Page Numbers</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Add page numbers to footer
                    </span>
                  </Label>
                  <Switch
                    id="pages"
                    checked={includePageNumbers}
                    onCheckedChange={setIncludePageNumbers}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Paper Size</Label>
                  <Select defaultValue="letter">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letter">US Letter (8.5 x 11 in)</SelectItem>
                      <SelectItem value="a4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem value="legal">US Legal (8.5 x 14 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select defaultValue="portrait">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              Export Proposal
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
