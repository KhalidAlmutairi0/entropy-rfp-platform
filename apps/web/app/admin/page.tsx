"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { usersApi, auditApi } from "@/lib/api";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Users, Shield, Activity, Search, RefreshCw, UserPlus,
  ChevronDown, CheckCircle2, XCircle, AlertCircle, Loader2
} from "lucide-react";
import type { User, AuditLog } from "@/lib/types";

type AdminTab = "users" | "audit";

const ROLE_LABELS: Record<string, string> = {
  ADMIN:          "مدير النظام",
  BD_MANAGER:     "مدير تطوير الأعمال",
  PRE_SALES:      "مبيعات مسبقة",
  PROPOSAL_WRITER: "كاتب مقترحات",
  REVIEWER:       "مراجع",
  READ_ONLY:      "قراءة فقط",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:           "bg-danger-50 text-danger-700 border-danger-200",
  BD_MANAGER:      "bg-primary-50 text-primary-700 border-primary-200",
  PRE_SALES:       "bg-info-50 text-info-700 border-info-200",
  PROPOSAL_WRITER: "bg-success-50 text-success-700 border-success-200",
  REVIEWER:        "bg-warning-50 text-warning-700 border-warning-200",
  READ_ONLY:       "bg-neutral-50 text-neutral-600 border-neutral-200",
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("");
  const [updatingRole, setUpdatingRole] = useState(false);

  const { data: usersData, isLoading: usersLoading, mutate: mutateUsers } = useSWR(
    ["admin-users", userSearch],
    () => usersApi.list({ search: userSearch || undefined }).then((r) => r.data)
  );
  const { data: auditData, isLoading: auditLoading, mutate: mutateAudit } = useSWR(
    ["audit", auditSearch],
    () => auditApi.list({ search: auditSearch || undefined }).then((r) => r.data)
  );

  const users: User[] = usersData?.items ?? [];
  const auditLogs: AuditLog[] = auditData?.items ?? [];

  const handleRoleUpdate = async () => {
    if (!editingUser || !newRole) return;
    setUpdatingRole(true);
    try {
      await usersApi.updateRole(editingUser.id, newRole);
      await mutateUsers();
      setEditingUser(null);
      setNewRole("");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    await usersApi.deactivate(userId);
    await mutateUsers();
  };

  return (
    <AppShell userRole="ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-h1 font-semibold text-neutral-900">لوحة الإدارة</h1>
          <p className="text-body-sm text-neutral-500 mt-1">إدارة المستخدمين والصلاحيات وسجل الأنشطة</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-1 -mb-px" aria-label="تبويبات الإدارة">
            {[
              { id: "users", label: "المستخدمون", icon: Users },
              { id: "audit", label: "سجل الأنشطة", icon: Activity },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as AdminTab)}
                className={cn(
                  "px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                  activeTab === id
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "users" && (
          <div className="space-y-4">
            {/* User filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
                <input
                  type="search"
                  placeholder="بحث بالاسم أو البريد..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-200 bg-white ps-9 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  aria-label="البحث في المستخدمين"
                />
              </div>
              <button
                onClick={() => mutateUsers()}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors"
                aria-label="تحديث"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
              <button className="h-9 px-3 flex items-center gap-1.5 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors">
                <UserPlus className="h-4 w-4" aria-hidden />
                دعوة مستخدم
              </button>
            </div>

            {/* Users table */}
            <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
              {usersLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-md" />)}
                </div>
              ) : (
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      {["المستخدم", "الدور", "الحالة", "آخر نشاط", "الإجراءات"].map((h) => (
                        <th key={h} className="px-4 py-3 text-start font-medium text-neutral-500 text-caption">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">لا توجد مستخدمون</td>
                      </tr>
                    ) : users.map((user) => (
                      <tr key={user.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-neutral-800">{user.name}</p>
                            <p className="text-caption text-neutral-400 dir-ltr">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-caption font-medium rounded-md border px-2 py-0.5",
                            ROLE_COLORS[user.role] ?? "bg-neutral-50 text-neutral-600 border-neutral-200"
                          )}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {user.isActive ? (
                            <span className="flex items-center gap-1 text-success-700 text-caption">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              نشط
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-neutral-400 text-caption">
                              <XCircle className="h-3.5 w-3.5" aria-hidden />
                              غير نشط
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-400 text-caption">—</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setEditingUser(user); setNewRole(user.role); }}
                              className="text-caption text-primary-600 hover:text-primary-700 font-medium"
                            >
                              تعديل الدور
                            </button>
                            {user.isActive && (
                              <button
                                onClick={() => handleDeactivate(user.id)}
                                className="text-caption text-danger-600 hover:text-danger-700 font-medium"
                              >
                                تعطيل
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4">
            {/* Audit filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
                <input
                  type="search"
                  placeholder="بحث في السجل..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-200 bg-white ps-9 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  aria-label="البحث في سجل الأنشطة"
                />
              </div>
              <button
                onClick={() => mutateAudit()}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors"
                aria-label="تحديث"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/audit/export`}
                className="h-9 px-3 flex items-center gap-1.5 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                download
              >
                تصدير CSV
              </a>
            </div>

            {/* Audit log table */}
            <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
              {auditLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-md" />)}
                </div>
              ) : (
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      {["الوقت", "المستخدم", "الإجراء", "النوع", "المعرّف"].map((h) => (
                        <th key={h} className="px-4 py-3 text-start font-medium text-neutral-500 text-caption">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">لا توجد سجلات</td>
                      </tr>
                    ) : auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 text-neutral-400 text-caption tabular-nums whitespace-nowrap">
                          {formatRelativeTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{log.userId ?? "النظام"}</td>
                        <td className="px-4 py-3">
                          <code className="text-caption bg-neutral-100 text-neutral-700 rounded px-1.5 py-0.5 font-mono">
                            {log.action}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-caption">{log.targetType}</td>
                        <td className="px-4 py-3 text-neutral-400 text-caption font-mono dir-ltr truncate max-w-[120px]">
                          {log.targetId ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Role edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-h3 font-semibold text-neutral-900">تعديل دور المستخدم</h3>
            <p className="text-body-sm text-neutral-600">{editingUser.name} — {editingUser.email}</p>

            <div>
              <label className="block text-body-sm font-medium text-neutral-700 mb-2">الدور الجديد</label>
              <div className="space-y-2">
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <label key={role} className={cn(
                    "flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors",
                    newRole === role ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:bg-neutral-50"
                  )}>
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={newRole === role}
                      onChange={() => setNewRole(role)}
                      className="accent-primary-600"
                    />
                    <span className="text-body-sm text-neutral-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditingUser(null); setNewRole(""); }}
                className="h-9 px-4 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={updatingRole || !newRole}
                className="h-9 px-4 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {updatingRole && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
