'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ClearSessionPage() {
  const router = useRouter()

  useEffect(() => {
    // Wipe all stored session data
    localStorage.clear()
    sessionStorage.clear()
    // Hard-redirect to login so the auth context re-initialises cleanly
    window.location.replace('/login')
  }, [])

  return (
    <div className="flex h-screen items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Clearing session…</span>
    </div>
  )
}
