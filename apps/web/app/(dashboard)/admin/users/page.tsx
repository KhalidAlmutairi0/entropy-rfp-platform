"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { users as usersApi } from "@/lib/api"
import type { UserListItem } from "@/lib/types"
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Loader2, 
  Shield, 
  Trash2, 
  UserCheck,
  UserX,
  Download
} from "lucide-react"

function errMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningUserId, setActioningUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState("editor")
  const [creatingUser, setCreatingUser] = useState(false)

  useEffect(() => {
    usersApi.list({ pageSize: 200 })
      .then((res) => setUsers(res.items))
      .catch((e) => setError(errMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
    )
  }, [searchQuery, users])

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return
    setCreatingUser(true)
    setError(null)
    try {
      const created = await usersApi.create({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole.toUpperCase(),
      })
      setUsers((prev) => [created, ...prev])
      setIsInviteOpen(false)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setNewRole("editor")
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setCreatingUser(false)
    }
  }

  const handleUpdateRole = async (id: string, role: string) => {
    setActioningUserId(id)
    setError(null)
    try {
      const updated = await usersApi.updateRole(id, role)
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActioningUserId(null)
    }
  }

  const handleDeactivate = async (id: string) => {
    setActioningUserId(id)
    setError(null)
    try {
      const updated = await usersApi.deactivate(id)
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setActioningUserId(null)
    }
  }

  const handleExport = () => {
    const headers = ["name", "email", "role", "status", "created_at"]
    const rows = users.map((u) => [
      u.name,
      u.email,
      u.role,
      u.isActive ? "active" : "inactive",
      u.createdAt,
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "users.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={users.length === 0}>
            <Download className="h-4 w-4 me-2" />
            Export
          </Button>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 me-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteName">Name</Label>
                  <Input
                    id="inviteName"
                    placeholder="Jane Doe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email Address</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invitePassword">Password</Label>
                  <Input
                    id="invitePassword"
                    type="password"
                    placeholder="Temporary password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteRole">Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={creatingUser || !newName.trim() || !newEmail.trim() || !newPassword.trim()}
                >
                  {creatingUser ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{users.filter((u) => u.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
              </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{users.filter((u) => u.role.toLowerCase() === "admin").length}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                  <UserX className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{users.filter((u) => !u.isActive).length}</p>
                  <p className="text-sm text-muted-foreground">Inactive Users</p>
                </div>
              </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          )}
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>{user.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center hidden sm:block">
                    <p className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">Created</p>
                  </div>
                  <Badge variant={user.role.toLowerCase() === "admin" ? "default" : user.role.toLowerCase() === "editor" ? "secondary" : "outline"}>
                    {user.role}
                  </Badge>
                  <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                    {user.isActive ? "active" : "inactive"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={actioningUserId === user.id}>
                        {actioningUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "ADMIN")}>
                        <Shield className="h-4 w-4 me-2" />
                        Set as Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "EDITOR")}>
                        <Shield className="h-4 w-4 me-2" />
                        Set as Editor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "VIEWER")}>
                        <Shield className="h-4 w-4 me-2" />
                        Set as Viewer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeactivate(user.id)}>
                        <Trash2 className="h-4 w-4 me-2" />
                        Deactivate User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {!loading && filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">No users found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
