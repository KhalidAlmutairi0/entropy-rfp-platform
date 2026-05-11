"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { audit } from "@/lib/api"
import type { AuditLog } from "@/lib/types"
import { 
  Search, 
  Download, 
  Filter,
  Loader2,
  FileText,
  User,
  Settings,
  Key,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Eye
} from "lucide-react"

const actionLabels: Record<string, string> = {
  "proposal.created": "Created proposal",
  "proposal.edited": "Edited proposal",
  "proposal.exported": "Exported proposal",
  "user.login": "User logged in",
  "user.logout": "User logged out",
  "user.invited": "Invited user",
  "settings.updated": "Updated settings",
  "api_key.created": "Created API key",
  "document.uploaded": "Uploaded document",
  "template.deleted": "Deleted template",
}

function getIcon(action: string) {
  if (action.startsWith("proposal.")) return Plus
  if (action.startsWith("user.login")) return LogIn
  if (action.startsWith("user.logout")) return LogOut
  if (action.startsWith("user.")) return User
  if (action.startsWith("settings.")) return Settings
  if (action.startsWith("api_key.")) return Key
  if (action.startsWith("document.")) return FileText
  if (action.startsWith("template.")) return Trash2
  if (action.endsWith(".edited")) return Edit
  return Eye
}

function getCategory(action: string) {
  const [prefix] = action.split(".")
  if (prefix === "proposal") return "proposals"
  if (prefix === "user" && (action.includes("login") || action.includes("logout"))) return "auth"
  if (prefix === "api_key") return "security"
  if (prefix === "document") return "documents"
  if (prefix === "template") return "templates"
  if (prefix === "settings") return "settings"
  if (prefix === "user") return "users"
  return prefix || "other"
}

function errMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

export default function AdminAuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  useEffect(() => {
    audit.list({ pageSize: 200 })
      .then((res) => setAuditLogs(res.items))
      .catch((e) => setError(errMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(auditLogs.map((log) => getCategory(log.action))))
    return ["all", ...unique]
  }, [auditLogs])

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return auditLogs.filter((log) => {
      const userText = (log.userEmail ?? "").toLowerCase()
      const targetText = `${log.targetType ?? ""} ${log.targetId ?? ""}`.toLowerCase()
      const actionText = log.action.toLowerCase()
      const matchesSearch = !q || userText.includes(q) || targetText.includes(q) || actionText.includes(q)
      const matchesCategory = categoryFilter === "all" || getCategory(log.action) === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [auditLogs, categoryFilter, searchQuery])

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const res = await audit.exportCsv()
      if (!res.ok) throw new Error("Failed to export audit logs")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "audit-logs.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search logs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 me-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === "all" ? "All Categories" : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
          {exporting ? "Exporting..." : "Export Logs"}
        </Button>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Complete audit trail of all system actions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logs...
            </div>
          )}
          <div className="space-y-2">
            {filteredLogs.map((log) => {
              const category = getCategory(log.action)
              const Icon = getIcon(log.action)
              const actor = log.userEmail ?? "System"
              const target = [log.targetType, log.targetId].filter(Boolean).join(" / ") || "—"
              return (
                <div 
                  key={log.id} 
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {actor.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{actor}</span>
                      <span className="text-sm text-muted-foreground">
                        {actionLabels[log.action] || log.action}
                      </span>
                      <span className="font-medium text-sm text-primary truncate">
                        {target}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span>IP: {log.ipAddress ?? "—"}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {category}
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            {!loading && filteredLogs.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">No logs found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
