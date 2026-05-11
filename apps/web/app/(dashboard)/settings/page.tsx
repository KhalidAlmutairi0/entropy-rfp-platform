"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/components/providers/language-provider"
import { useAuth } from "@/contexts/auth-context"
import { auth as authApi, users as usersApi } from "@/lib/api"
import type { UserListItem } from "@/lib/types"
import { toast } from "sonner"
import {
  User,
  Building2,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Mail,
  Save,
  Trash2,
  Link,
  Slack,
  MessageSquare,
  Loader2,
} from "lucide-react"

export default function SettingsPage() {
  const { t, direction: dir, language, setLanguage } = useLanguage()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")

  // Profile form state
  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [phone, setPhone] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [slackNotifications, setSlackNotifications] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)

  // Security
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)

  // Organization team members
  const [teamMembers, setTeamMembers] = useState<UserListItem[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  // Populate form from authenticated user
  useEffect(() => {
    if (!user) return
    setName(user.name ?? "")
    setTitle(user.title ?? "")
    setPhone(user.phone ?? "")
    setEmailNotifications(user.notificationEmail ?? true)
    setSlackNotifications(user.notificationSlack ?? false)
    setTwoFactorAuth(user.mfaEnabled ?? false)
  }, [user])

  // Load team members when Organization tab is active
  useEffect(() => {
    if (activeTab !== "organization") return
    setLoadingTeam(true)
    usersApi.list({ pageSize: 50 })
      .then((res) => setTeamMembers(res.items))
      .catch(() => {/* non-admin users won't have access — that's fine */})
      .finally(() => setLoadingTeam(false))
  }, [activeTab])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await authApi.updateMe({ name: name.trim(), title: title.trim(), phone: phone.trim() })
      toast.success("Profile updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSavingNotifications(true)
    try {
      await authApi.updateMe({
        notification_email: emailNotifications,
        notification_slack: slackNotifications,
      })
      toast.success("Notification preferences saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save preferences")
    } finally {
      setSavingNotifications(false)
    }
  }

  const handleEmailNotificationChange = async (val: boolean) => {
    setEmailNotifications(val)
    try {
      await authApi.updateMe({ notification_email: val })
    } catch {/* optimistic — revert on hard failure */}
  }

  const handleSlackNotificationChange = async (val: boolean) => {
    setSlackNotifications(val)
    try {
      await authApi.updateMe({ notification_slack: val })
    } catch {/* optimistic */}
  }

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang as 'en' | 'ar')
    try {
      await authApi.updateMe({ preferred_language: lang })
    } catch {/* non-critical */}
  }

  return (
    <div className="flex flex-col gap-6 p-6" dir={dir}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings_description")}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical">
            <TabsList className="flex lg:flex-col h-auto w-full bg-transparent p-0 gap-1">
              <TabsTrigger
                value="profile"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="organization"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <Building2 className="h-4 w-4" />
                Organization
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger
                value="appearance"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <Palette className="h-4 w-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger
                value="integrations"
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-muted"
              >
                <Link className="h-4 w-4" />
                Integrations
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="profile" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Manage your personal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-lg">
                        {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <Badge variant="secondary" className="text-xs">{user?.role}</Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Form Fields */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={user?.email ?? ""} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966 5x xxx xxxx"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => {
                      setName(user?.name ?? "")
                      setTitle(user?.title ?? "")
                      setPhone(user?.phone ?? "")
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organization" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                  <CardDescription>View your organization&apos;s team members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-4">Team Members</h4>
                    {loadingTeam ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading team...
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No team members found or insufficient permissions.</p>
                    ) : (
                      <div className="space-y-3">
                        {teamMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{member.role}</Badge>
                              {!member.isActive && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" className="mt-4" disabled>
                      <Mail className="h-4 w-4 me-2" />
                      Invite Team Member
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Manage how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={handleEmailNotificationChange}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Slack Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications in Slack
                      </p>
                    </div>
                    <Switch
                      checked={slackNotifications}
                      onCheckedChange={handleSlackNotificationChange}
                    />
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-4">Notification Types</h4>
                    <div className="space-y-3">
                      {[
                        { label: "RFP Deadlines", description: "Alerts for upcoming deadlines" },
                        { label: "Team Activity", description: "Updates when team members make changes" },
                        { label: "AI Suggestions", description: "New AI-generated recommendations" },
                        { label: "System Updates", description: "Platform updates and maintenance" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage your account security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Change Password</h4>
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" />
                      </div>
                      <Button>
                        <Key className="h-4 w-4 me-2" />
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        {user?.mfaEnabled ? "2FA is enabled on your account" : "Add an extra layer of security to your account"}
                      </p>
                    </div>
                    <Switch checked={twoFactorAuth} onCheckedChange={setTwoFactorAuth} disabled={user?.mfaEnabled} />
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium text-destructive mb-2">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Permanently delete your account and all associated data
                    </p>
                    <Button variant="destructive" disabled>
                      <Trash2 className="h-4 w-4 me-2" />
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance Settings</CardTitle>
                  <CardDescription>Customize the look and feel</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>{t("language")}</Label>
                    <Select value={language} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="w-full max-w-xs">
                        <Globe className="h-4 w-4 me-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-4 max-w-md">
                      <button className="p-4 rounded-lg border-2 border-primary bg-background text-center">
                        <div className="w-full h-8 rounded bg-background border mb-2" />
                        <span className="text-sm">Light</span>
                      </button>
                      <button className="p-4 rounded-lg border bg-background text-center hover:border-primary">
                        <div className="w-full h-8 rounded bg-zinc-900 mb-2" />
                        <span className="text-sm">Dark</span>
                      </button>
                      <button className="p-4 rounded-lg border bg-background text-center hover:border-primary">
                        <div className="w-full h-8 rounded bg-gradient-to-r from-background to-zinc-900 mb-2" />
                        <span className="text-sm">System</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect external services</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Slack", description: "Get notifications in Slack", icon: Slack, connected: slackNotifications },
                    { name: "Microsoft Teams", description: "Sync with Teams channels", icon: MessageSquare, connected: false },
                    { name: "Google Drive", description: "Import documents from Drive", icon: Globe, connected: false },
                    { name: "Salesforce", description: "Sync with CRM data", icon: Building2, connected: false },
                  ].map((integration) => {
                    const Icon = integration.icon
                    return (
                      <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <p className="text-sm text-muted-foreground">{integration.description}</p>
                          </div>
                        </div>
                        <Button variant={integration.connected ? "outline" : "default"} size="sm" disabled>
                          {integration.connected ? "Disconnect" : "Connect"}
                        </Button>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
