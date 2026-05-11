"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { users as usersApi } from "@/lib/api"
import { 
  Loader2,
  Users,
  FileText,
  Settings,
  Database,
  Plus
} from "lucide-react"

const permissionGroups = [
  {
    name: "Proposals",
    icon: FileText,
    permissions: [
      { key: "proposals.view", label: "View proposals", admin: true, editor: true, viewer: true },
      { key: "proposals.create", label: "Create proposals", admin: true, editor: true, viewer: false },
      { key: "proposals.edit", label: "Edit proposals", admin: true, editor: true, viewer: false },
      { key: "proposals.delete", label: "Delete proposals", admin: true, editor: false, viewer: false },
      { key: "proposals.export", label: "Export proposals", admin: true, editor: true, viewer: true },
    ]
  },
  {
    name: "Knowledge Base",
    icon: Database,
    permissions: [
      { key: "kb.view", label: "View documents", admin: true, editor: true, viewer: true },
      { key: "kb.upload", label: "Upload documents", admin: true, editor: true, viewer: false },
      { key: "kb.edit", label: "Edit documents", admin: true, editor: true, viewer: false },
      { key: "kb.delete", label: "Delete documents", admin: true, editor: false, viewer: false },
    ]
  },
  {
    name: "Templates",
    icon: FileText,
    permissions: [
      { key: "templates.view", label: "View templates", admin: true, editor: true, viewer: true },
      { key: "templates.create", label: "Create templates", admin: true, editor: true, viewer: false },
      { key: "templates.edit", label: "Edit templates", admin: true, editor: true, viewer: false },
      { key: "templates.delete", label: "Delete templates", admin: true, editor: false, viewer: false },
    ]
  },
  {
    name: "Users & Teams",
    icon: Users,
    permissions: [
      { key: "users.view", label: "View users", admin: true, editor: true, viewer: false },
      { key: "users.invite", label: "Invite users", admin: true, editor: false, viewer: false },
      { key: "users.edit", label: "Edit users", admin: true, editor: false, viewer: false },
      { key: "users.remove", label: "Remove users", admin: true, editor: false, viewer: false },
    ]
  },
  {
    name: "Settings",
    icon: Settings,
    permissions: [
      { key: "settings.view", label: "View settings", admin: true, editor: true, viewer: false },
      { key: "settings.edit", label: "Edit settings", admin: true, editor: false, viewer: false },
      { key: "settings.api", label: "Manage API keys", admin: true, editor: false, viewer: false },
      { key: "settings.billing", label: "Manage billing", admin: true, editor: false, viewer: false },
    ]
  },
]

export default function AdminPermissionsPage() {
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({
    admin: 0,
    editor: 0,
    viewer: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    usersApi.list({ pageSize: 200 })
      .then((res) => {
        const counts = { admin: 0, editor: 0, viewer: 0 }
        res.items.forEach((u) => {
          const role = u.role.toLowerCase()
          if (role === "admin" || role === "editor" || role === "viewer") {
            counts[role] += 1
          }
        })
        setRoleCounts(counts)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load roles"))
      .finally(() => setLoading(false))
  }, [])

  const roles = useMemo(() => ([
    {
      name: "Admin",
      description: "Full access to all features and settings",
      userCount: roleCounts.admin,
      color: "bg-red-100 text-red-700",
    },
    {
      name: "Editor",
      description: "Can create and edit proposals, limited admin access",
      userCount: roleCounts.editor,
      color: "bg-blue-100 text-blue-700",
    },
    {
      name: "Viewer",
      description: "Read-only access to proposals and reports",
      userCount: roleCounts.viewer,
      color: "bg-gray-100 text-gray-700",
    },
  ]), [roleCounts])

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Roles Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className={role.color}>{role.name}</Badge>
                <span className="text-sm text-muted-foreground">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin inline-block" /> : `${role.userCount} users`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{role.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Permission Matrix</CardTitle>
              <CardDescription>Configure permissions for each role</CardDescription>
            </div>
            <Button variant="outline">
              <Plus className="h-4 w-4 me-2" />
              Create Custom Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mb-4">
            <div className="flex-1 font-medium">Permission</div>
            <div className="w-24 text-center font-medium">Admin</div>
            <div className="w-24 text-center font-medium">Editor</div>
            <div className="w-24 text-center font-medium">Viewer</div>
          </div>

          {/* Permission Groups */}
          <div className="space-y-6">
            {permissionGroups.map((group) => {
              const Icon = group.icon
              return (
                <div key={group.name}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium">{group.name}</h4>
                  </div>
                  <div className="space-y-2">
                    {group.permissions.map((permission) => (
                      <div 
                        key={permission.key}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 text-sm">{permission.label}</div>
                        <div className="w-24 flex justify-center">
                          <Switch checked={permission.admin} disabled />
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch checked={permission.editor} />
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch checked={permission.viewer} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              )
            })}
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6">
            <Button>Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
