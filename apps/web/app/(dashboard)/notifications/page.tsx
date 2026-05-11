'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/components/providers/language-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bell,
  FileText,
  CheckCircle2,
  Clock,
  MessageSquare,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { notifications as notificationsApi } from '@/lib/api'
import type { Notification } from '@/lib/types'

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'rfp': return FileText
    case 'proposal': return CheckCircle2
    case 'deadline': return Clock
    case 'comment': return MessageSquare
    default: return Bell
  }
}

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'rfp': return 'text-[#3B82F6] bg-[#3B82F6]/10'
    case 'proposal': return 'text-[#10B981] bg-[#10B981]/10'
    case 'deadline': return 'text-[#F59E0B] bg-[#F59E0B]/10'
    case 'comment': return 'text-[#8B5CF6] bg-[#8B5CF6]/10'
    default: return 'text-primary bg-primary/10'
  }
}

export default function NotificationsPage() {
  const { t, direction } = useLanguage()
  const [notificationList, setNotificationList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [markingAllRead, setMarkingAllRead] = useState(false)

  useEffect(() => {
    notificationsApi.list()
      .then((res) => setNotificationList(res.items))
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false))
  }, [])

  const unreadCount = notificationList.filter((n) => !n.isRead).length

  const toggleNotification = (id: string) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const markAsRead = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => notificationsApi.markRead(id)))
      setNotificationList((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
      )
      setSelectedNotifications([])
    } catch {/* ignore */}
  }

  const markAllAsRead = async () => {
    setMarkingAllRead(true)
    try {
      await notificationsApi.markAllRead()
      setNotificationList((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {/* ignore */} finally {
      setMarkingAllRead(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const renderNotification = (notification: Notification, showCheckbox = true) => {
    const Icon = getNotificationIcon(notification.type)
    return (
      <div
        key={notification.id}
        className={cn(
          'flex items-start gap-4 p-4 transition-colors hover:bg-muted/50',
          !notification.isRead && 'bg-primary/5'
        )}
      >
        {showCheckbox && (
          <Checkbox
            checked={selectedNotifications.includes(notification.id)}
            onCheckedChange={() => toggleNotification(notification.id)}
            className="mt-1"
          />
        )}
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', getNotificationColor(notification.type))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={cn('font-medium', !notification.isRead && 'font-semibold')}>
                {direction === 'rtl' ? (notification.titleAr || notification.titleEn) : (notification.titleEn || notification.titleAr)}
              </h4>
              <p className="text-sm text-muted-foreground mt-0.5">
                {direction === 'rtl' ? (notification.bodyAr || notification.bodyEn) : (notification.bodyEn || notification.bodyAr)}
              </p>
            </div>
            {!notification.isRead && (
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{formatTime(notification.createdAt)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.notifications')}</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading...' : `You have ${unreadCount} unread notifications`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedNotifications.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => markAsRead(selectedNotifications)}>
                <Check className="h-4 w-4 mr-1" />
                Mark as read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNotificationList(prev => prev.filter(n => !selectedNotifications.includes(n.id)))
                  setSelectedNotifications([])
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={markingAllRead || unreadCount === 0}>
            {markingAllRead
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Marking...</>
              : <><CheckCircle2 className="h-4 w-4 mr-1" />Mark all as read</>}
          </Button>
        </div>
      </div>

      {/* Notification Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            All
            <Badge variant="secondary" className="text-xs">
              {notificationList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-2">
            Unread
            <Badge variant="secondary" className="text-xs">
              {unreadCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rfp">RFP Updates</TabsTrigger>
          <TabsTrigger value="deadline">Deadlines</TabsTrigger>
          <TabsTrigger value="comment">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 m-4" />)
                : notificationList.length === 0
                ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No notifications</p>
                  </div>
                )
                : notificationList.map(n => renderNotification(n, true))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 m-4" />)
                : notificationList.filter(n => !n.isRead).length === 0
                ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>All caught up!</p>
                    <p className="text-sm">No unread notifications</p>
                  </div>
                )
                : notificationList.filter(n => !n.isRead).map(n => renderNotification(n, true))}
            </CardContent>
          </Card>
        </TabsContent>

        {['rfp', 'deadline', 'comment'].map((category) => (
          <TabsContent key={category} value={category} className="mt-4">
            <Card>
              <CardContent className="p-0 divide-y">
                {loading
                  ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 m-4" />)
                  : notificationList.filter(n => n.type === category).length === 0
                  ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notifications in this category</p>
                    </div>
                  )
                  : notificationList
                      .filter(n => n.type === category)
                      .map(n => renderNotification(n, false))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
