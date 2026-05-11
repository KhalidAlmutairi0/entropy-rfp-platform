'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Plus,
  Upload,
  FolderOpen,
  FileText,
  FileImage,
  FileSpreadsheet,
  MoreHorizontal,
  Download,
  Trash2,
  Edit,
  Star,
  Clock,
  Grid3X3,
  List,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { knowledge } from '@/lib/api'
import type { KnowledgeDoc, KnowledgeStats } from '@/lib/types'

const getFileIcon = (docType: string) => {
  switch (docType.toLowerCase()) {
    case 'spreadsheet': return FileSpreadsheet
    case 'image': return FileImage
    default: return FileText
  }
}

const getFileColor = (docType: string) => {
  switch (docType.toLowerCase()) {
    case 'pdf': return 'text-[#EF4444] bg-[#EF4444]/10'
    case 'proposal': return 'text-[#3B82F6] bg-[#3B82F6]/10'
    case 'case_study': return 'text-[#10B981] bg-[#10B981]/10'
    case 'template': return 'text-[#F59E0B] bg-[#F59E0B]/10'
    default: return 'text-muted-foreground bg-muted'
  }
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgeBasePage() {
  const { t, direction } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsRes, statsRes] = await Promise.allSettled([
          knowledge.list({ pageSize: 100 }),
          knowledge.stats(),
        ])
        if (docsRes.status === 'fulfilled') setDocs(docsRes.value.items)
        if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const doc = await knowledge.upload(formData)
      setDocs(prev => [doc, ...prev])
    } catch {/* ignore */} finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const docTypes = ['all', ...Array.from(new Set(docs.map(d => d.docType)))]

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.docType.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === 'all' || doc.docType === selectedType
    return matchesSearch && matchesType
  })

  const categories = [
    { id: 'all', name: 'All Documents', count: docs.length },
    ...Array.from(new Set(docs.map(d => d.docType))).map(type => ({
      id: type,
      name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count: docs.filter(d => d.docType === type).length,
    })),
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xlsx,.pptx"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.knowledgeBase')}</h1>
          <p className="text-muted-foreground">
            {stats
              ? `${stats.total} documents · ${stats.indexed} indexed`
              : 'Centralized repository of proposals, case studies, and resources'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleUploadClick} disabled={uploading}>
            {uploading
              ? <><Loader2 className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'} animate-spin`} />Uploading...</>
              : <><Upload className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />Upload</>}
          </Button>
          <Button>
            <Plus className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            New Folder
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`bg-muted/50 border-0 ${direction === 'rtl' ? 'pr-9' : 'pl-9'}`}
          />
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Categories */}
        <div className="w-56 shrink-0 space-y-1">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
            : categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedType(category.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedType === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>{category.name}</span>
                  </div>
                  <Badge
                    variant={selectedType === category.id ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {category.count}
                  </Badge>
                </button>
              ))}
        </div>

        {/* Document Grid/List */}
        <div className="flex-1">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="indexed">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Indexed
              </TabsTrigger>
              <TabsTrigger value="recent">
                <Clock className="h-4 w-4 mr-1" />
                Recent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredDocs.map((doc) => {
                    const Icon = getFileIcon(doc.docType)
                    return (
                      <Card key={doc.id} className="group hover:border-primary/50 transition-colors cursor-pointer relative">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', getFileColor(doc.docType))}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <h4 className="font-medium text-sm line-clamp-2 mb-2">{doc.title}</h4>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatBytes(doc.sizeBytes)}</span>
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                          {doc.isIndexed && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-[#10B981]">
                              <CheckCircle2 className="h-3 w-3" />
                              Indexed
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {filteredDocs.map((doc) => {
                    const Icon = getFileIcon(doc.docType)
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', getFileColor(doc.docType))}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                          <p className="text-xs text-muted-foreground">{doc.docType}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {doc.isIndexed && <CheckCircle2 className="h-4 w-4 text-[#10B981]" />}
                          <span>{formatBytes(doc.sizeBytes)}</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </div>
              )}
              {!loading && filteredDocs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="indexed" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDocs.filter((d) => d.isIndexed).map((doc) => {
                  const Icon = getFileIcon(doc.docType)
                  return (
                    <Card key={doc.id} className="group hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-3', getFileColor(doc.docType))}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <h4 className="font-medium text-sm line-clamp-2 mb-2">{doc.title}</h4>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatBytes(doc.sizeBytes)}</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Recently accessed documents will appear here</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
