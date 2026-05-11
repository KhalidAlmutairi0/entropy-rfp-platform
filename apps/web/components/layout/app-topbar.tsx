'use client'

import { useTheme } from 'next-themes'
import { Bell, Moon, Sun, Search, Globe, Monitor } from 'lucide-react'
import Link from 'next/link'

import { useLanguage } from '@/components/providers/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const notifications = [
  {
    id: 1,
    title: 'New RFP uploaded',
    description: 'Tech Corp has uploaded a new RFP for review',
    time: '5 min ago',
    unread: true,
  },
  {
    id: 2,
    title: 'Proposal approved',
    description: 'Your proposal for Project Alpha has been approved',
    time: '1 hour ago',
    unread: true,
  },
  {
    id: 3,
    title: 'Deadline reminder',
    description: 'RFP submission deadline in 2 days',
    time: '3 hours ago',
    unread: false,
  },
]

export function AppTopbar() {
  const { t, language, setLanguage, direction } = useLanguage()
  const { theme, setTheme } = useTheme()
  
  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${direction === 'rtl' ? 'right-3' : 'left-3'}`} />
          <Input
            type="search"
            placeholder={t('common.search')}
            className={`h-9 bg-muted/50 border-0 ${direction === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language Switch */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Globe className="h-4 w-4" />
              <span className="sr-only">Switch language</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'}>
            <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className={language === 'en' ? 'bg-accent' : ''}
            >
              <span className="mr-2">🇺🇸</span>
              English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('ar')}
              className={language === 'ar' ? 'bg-accent' : ''}
            >
              <span className="mr-2">🇸🇦</span>
              العربية
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'}>
            <DropdownMenuLabel>{t('settings.theme')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'bg-accent' : ''}
            >
              <Sun className="mr-2 h-4 w-4" />
              {t('settings.themeLight')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'bg-accent' : ''}
            >
              <Moon className="mr-2 h-4 w-4" />
              {t('settings.themeDark')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('system')}
              className={theme === 'system' ? 'bg-accent' : ''}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t('settings.themeSystem')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
              <span className="sr-only">{t('nav.notifications')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align={direction === 'rtl' ? 'start' : 'end'}
            className="w-80 p-0"
          >
            <div className="flex items-center justify-between border-b p-3">
              <h4 className="font-semibold">{t('nav.notifications')}</h4>
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex gap-3 border-b p-3 last:border-0 ${
                    notification.unread ? 'bg-muted/50' : ''
                  }`}
                >
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      notification.unread ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/notifications">{t('common.viewAll')}</Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
