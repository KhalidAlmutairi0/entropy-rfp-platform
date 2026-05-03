"use client";

import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { notificationApi } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Bell, BellOff, CheckCheck, CheckCircle2, AlertCircle, Info, FileText } from "lucide-react";
import Link from "next/link";
import type { Notification } from "@/lib/types";

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  ANALYSIS_COMPLETE: CheckCircle2,
  DECISION_READY:    CheckCircle2,
  ACTION_REQUIRED:   AlertCircle,
  PROPOSAL_READY:    FileText,
  REVIEW_REQUEST:    Bell,
  SYSTEM:            Info,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  ANALYSIS_COMPLETE: "text-success-600 bg-success-50",
  DECISION_READY:    "text-success-600 bg-success-50",
  ACTION_REQUIRED:   "text-warning-600 bg-warning-50",
  PROPOSAL_READY:    "text-primary-600 bg-primary-50",
  REVIEW_REQUEST:    "text-neutral-600 bg-neutral-100",
  SYSTEM:            "text-neutral-600 bg-neutral-100",
};

export default function NotificationsPage() {
  const { data, isLoading, mutate } = useSWR(
    "notifications",
    () => notificationApi.list().then((r) => r.data)
  );

  const notifications: Notification[] = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    await mutate();
  };

  const markRead = async (id: string) => {
    await notificationApi.markRead(id);
    await mutate();
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-semibold text-neutral-900">الإشعارات</h1>
            {unreadCount > 0 && (
              <p className="text-body-sm text-neutral-500 mt-0.5">{unreadCount} غير مقروء</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <CheckCheck className="h-4 w-4" aria-hidden />
              تحديد الكل كمقروء
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-md" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BellOff className="h-10 w-10 text-neutral-200 mb-3" aria-hidden />
              <p className="text-h3 font-semibold text-neutral-700 mb-1">لا توجد إشعارات</p>
              <p className="text-body-sm text-neutral-400">ستظهر هنا الإشعارات المتعلقة بالمناقصات والتحليلات</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-50" aria-label="قائمة الإشعارات">
              {notifications.map((n) => {
                const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
                const iconColor = NOTIFICATION_COLORS[n.type] ?? "text-neutral-600 bg-neutral-100";
                const content = (
                  <div className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors",
                    !n.isRead ? "bg-primary-50/30 hover:bg-primary-50/50" : "hover:bg-neutral-50"
                  )}>
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", iconColor)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-body-sm leading-snug", !n.isRead ? "font-semibold text-neutral-900" : "font-medium text-neutral-700")}>
                        {n.titleAr}
                      </p>
                      {n.bodyAr && (
                        <p className="text-caption text-neutral-500 mt-0.5 leading-relaxed">{n.bodyAr}</p>
                      )}
                      <p className="text-caption text-neutral-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.preventDefault(); markRead(n.id); }}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors shrink-0"
                        aria-label="تحديد كمقروء"
                      >
                        <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.deepLink ? (
                      <Link href={n.deepLink} onClick={() => !n.isRead && markRead(n.id)}>
                        {content}
                      </Link>
                    ) : (
                      <div>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
