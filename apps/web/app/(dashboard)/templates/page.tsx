'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Search,
  Plus,
  FileText,
  Copy,
  Edit,
  Trash2,
  Eye,
  Star,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { templates as templatesApi } from '@/lib/api'
import type { Template } from '@/lib/types'

const templateCategories = [
  { id: 'all', name: 'All Templates' },
]

export default function TemplatesPage() {
  const { t, direction } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [templateList, setTemplateList] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newNameEn, setNewNameEn] = useState('')
  const [newNameAr, setNewNameAr] = useState('')

  useEffect(() => {
    templatesApi.list()
      .then((res) => setTemplateList(res.items))
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await templatesApi.delete(id)
      setTemplateList(prev => prev.filter(t => t.id !== id))
    } catch {/* ignore */} finally {
      setDeleting(null)
    }
  }

  const handleCreate = async () => {
    if (!newNameEn.trim() && !newNameAr.trim()) return
    setCreating(true)
    try {
      const created = await templatesApi.create({
        nameEn: newNameEn || newNameAr,
        nameAr: newNameAr || newNameEn,
        supportedLanguages: ['ar', 'en'],
      })
      setTemplateList(prev => [created, ...prev])
      setCreateOpen(false)
      setNewNameEn('')
      setNewNameAr('')
    } catch {/* ignore */} finally {
      setCreating(false)
    }
  }

  const filteredTemplates = templateList.filter((template) => {
    const name = template.nameEn + ' ' + template.nameAr
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.templates')}</h1>
          <p className="text-muted-foreground">
            Manage and customize proposal templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Sparkles className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            Generate with AI
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className={`h-4 w-4 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>Add a new proposal template to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nameEn">Name (English)</Label>
                  <Input
                    id="nameEn"
                    placeholder="Template name in English"
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameAr">Name (Arabic)</Label>
                  <Input
                    id="nameAr"
                    placeholder="اسم القالب بالعربية"
                    value={newNameAr}
                    onChange={(e) => setNewNameAr(e.target.value)}
                    dir="rtl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || (!newNameEn.trim() && !newNameAr.trim())}>
                  {creating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Creating...</> : 'Create Template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`bg-muted/50 border-0 ${direction === 'rtl' ? 'pr-9' : 'pl-9'}`}
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          {templateCategories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    'group hover:border-primary/50 transition-colors cursor-pointer relative'
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">
                      {direction === 'rtl' ? (template.nameAr || template.nameEn) : (template.nameEn || template.nameAr)}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {template.projectTypes?.join(', ') || 'General purpose template'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="text-xs">
                        {template.sections.length} sections
                      </Badge>
                      {template.supportedLanguages.map(lang => (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {lang.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{template.nameEn || template.nameAr}</DialogTitle>
                            <DialogDescription>
                              {template.supportedLanguages.join(', ')} · {template.sections.length} sections
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-muted">
                                  <p className="text-sm text-muted-foreground">Sections</p>
                                  <p className="text-2xl font-bold">{template.sections.length}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted">
                                  <p className="text-sm text-muted-foreground">Languages</p>
                                  <p className="text-2xl font-bold">{template.supportedLanguages.length}</p>
                                </div>
                              </div>
                              {template.sections.length > 0 && (
                                <div className="p-4 rounded-lg border">
                                  <h4 className="font-medium mb-2">Template Sections</h4>
                                  <ul className="space-y-2 text-sm text-muted-foreground">
                                    {template.sections.map((s, i) => (
                                      <li key={s.id}>{i + 1}. {s.titleEn || s.titleAr}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit Template
                            </Button>
                            <Button>
                              <Copy className="h-4 w-4 mr-1" />
                              Use Template
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                      >
                        {deleting === template.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates found</p>
              <p className="text-sm">Try a different search or create a new template</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
