"use client"

import { useLanguage } from "@/components/providers/language-provider"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Users, Key, Activity, Shield } from "lucide-react"

const adminNavItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/api-keys", label: "API Keys", icon: Key },
  { href: "/admin/audit-log", label: "Audit Log", icon: Activity },
  { href: "/admin/permissions", label: "Permissions", icon: Shield },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { dir } = useLanguage()
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-6 p-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users, permissions, and system settings
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
