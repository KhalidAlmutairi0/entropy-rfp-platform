"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Plus, 
  Key, 
  Copy, 
  Trash2, 
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle
} from "lucide-react"

const apiKeys = [
  { 
    id: "1", 
    name: "Production API Key", 
    key: "ent_prod_***********************ab12",
    permissions: "Full Access",
    created: "Jan 15, 2024",
    lastUsed: "2 hours ago",
    status: "active"
  },
  { 
    id: "2", 
    name: "Development Key", 
    key: "ent_dev_************************cd34",
    permissions: "Read Only",
    created: "Feb 20, 2024",
    lastUsed: "1 day ago",
    status: "active"
  },
  { 
    id: "3", 
    name: "Testing Environment", 
    key: "ent_test_***********************ef56",
    permissions: "Limited",
    created: "Mar 10, 2024",
    lastUsed: "1 week ago",
    status: "active"
  },
  { 
    id: "4", 
    name: "Legacy Integration", 
    key: "ent_legacy_*********************gh78",
    permissions: "Full Access",
    created: "Dec 1, 2023",
    lastUsed: "Never",
    status: "expired"
  },
]

export default function AdminApiKeysPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState<string | null>(null)

  const handleCreateKey = () => {
    // Simulate key creation
    setNewKey("ent_new_xK9mN2pL5qR8sT1uV4wY7zA3bC6dE0fG")
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            API keys are used to authenticate requests to the Entropy API
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) setNewKey(null)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for accessing the Entropy API
              </DialogDescription>
            </DialogHeader>
            
            {newKey ? (
              <div className="space-y-4 py-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure to copy your API key now. You won&apos;t be able to see it again!
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Your New API Key</Label>
                  <div className="flex gap-2">
                    <Input value={newKey} readOnly className="font-mono text-sm" />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => navigator.clipboard.writeText(newKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input id="keyName" placeholder="e.g., Production API Key" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permissions">Permissions</Label>
                  <Select defaultValue="full">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Access</SelectItem>
                      <SelectItem value="read">Read Only</SelectItem>
                      <SelectItem value="limited">Limited (Proposals Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration">Expiration</Label>
                  <Select defaultValue="never">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30days">30 Days</SelectItem>
                      <SelectItem value="90days">90 Days</SelectItem>
                      <SelectItem value="1year">1 Year</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            <DialogFooter>
              {newKey ? (
                <Button onClick={() => {
                  setIsCreateOpen(false)
                  setNewKey(null)
                }}>
                  <CheckCircle className="h-4 w-4 me-2" />
                  Done
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey}>
                    <Key className="h-4 w-4 me-2" />
                    Generate Key
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>Manage your API keys and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div 
                key={apiKey.id} 
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <Key className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{apiKey.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {showKey === apiKey.id ? "ent_full_xK9mN2pL5qR8sT1uV4wY7zA3bC6dE0fG" : apiKey.key}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                      >
                        {showKey === apiKey.id ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => navigator.clipboard.writeText(apiKey.key)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-end hidden sm:block">
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-sm">{apiKey.created}</p>
                  </div>
                  <div className="text-end hidden md:block">
                    <p className="text-sm text-muted-foreground">Last Used</p>
                    <p className="text-sm">{apiKey.lastUsed}</p>
                  </div>
                  <Badge variant="secondary">{apiKey.permissions}</Badge>
                  <Badge variant={apiKey.status === "active" ? "default" : "outline"} className={
                    apiKey.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""
                  }>
                    {apiKey.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Usage</CardTitle>
          <CardDescription>Monitor your API consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <p className="text-2xl font-semibold">12,847</p>
              <p className="text-sm text-muted-foreground">Requests Today</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-2xl font-semibold">342,156</p>
              <p className="text-sm text-muted-foreground">Requests This Month</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-2xl font-semibold">99.9%</p>
              <p className="text-sm text-muted-foreground">Uptime</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
