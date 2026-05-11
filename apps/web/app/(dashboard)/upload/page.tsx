'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { rfps as rfpsApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, X, CheckCircle2, Loader2, CloudUpload, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectedFile {
  id: string
  file: File
  fileType: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
}

export default function UploadRfpPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [agency, setAgency] = useState('')

  const addFiles = (newFiles: File[]) => {
    const entries: SelectedFile[] = newFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      fileType: 'MAIN',
      progress: 0,
      status: 'pending',
    }))
    setSelectedFiles((prev) => [...prev, ...entries])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const removeFile = (id: string) => setSelectedFiles((prev) => prev.filter((f) => f.id !== id))

  const updateFileType = (id: string, type: string) =>
    setSelectedFiles((prev) => prev.map((f) => f.id === id ? { ...f, fileType: type } : f))

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return
    setError('')
    setIsSubmitting(true)
    setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading', progress: 50 })))

    try {
      const formData = new FormData()
      selectedFiles.forEach((sf) => formData.append('files', sf.file))
      formData.append('file_types', selectedFiles.map((sf) => sf.fileType).join(','))
      if (titleEn) formData.append('title_en', titleEn)
      if (agency) formData.append('agency', agency)

      const rfp = await rfpsApi.upload(formData)
      setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'complete', progress: 100 })))
      setTimeout(() => router.push(`/rfp/${rfp.id}/processing`), 800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'error', progress: 0 })))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.upload')}</h1>
        <p className="text-muted-foreground">Upload RFP documents for AI analysis</p>
      </div>

      <Card
        className={cn('border-2 border-dashed transition-colors cursor-pointer', isDragOver && 'border-primary bg-primary/5')}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CloudUpload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, DOC, DOCX — up to 50MB each</p>
          <input id="file-input" type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={handleFileInput} />
        </CardContent>
      </Card>

      {selectedFiles.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Selected Files</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selectedFiles.map((sf) => (
              <div key={sf.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sf.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(sf.file.size / 1024 / 1024).toFixed(1)} MB</p>
                  {sf.status === 'uploading' && <Progress value={sf.progress} className="h-1 mt-1" />}
                </div>
                <Select value={sf.fileType} onValueChange={(v) => updateFileType(sf.id, v)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN">Main</SelectItem>
                    <SelectItem value="ANNEX">Annex</SelectItem>
                    <SelectItem value="CLARIFICATION">Clarification</SelectItem>
                  </SelectContent>
                </Select>
                {sf.status === 'complete' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                {sf.status !== 'uploading' && sf.status !== 'complete' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFile(sf.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>RFP Details (Optional)</CardTitle>
          <CardDescription>Add metadata to help with analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title-en">RFP Title (English)</Label>
            <Input id="title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="e.g. Cloud Infrastructure Modernization" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agency">Agency / Client</Label>
            <Input id="agency" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. Ministry of Finance" />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <Button className="w-full" size="lg" disabled={selectedFiles.length === 0 || isSubmitting} onClick={handleSubmit}>
        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><Upload className="mr-2 h-4 w-4" />Upload & Analyze</>}
      </Button>
    </div>
  )
}
