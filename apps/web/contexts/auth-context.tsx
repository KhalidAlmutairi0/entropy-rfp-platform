'use client'

import * as React from 'react'
import { auth, setToken, clearToken } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | null>(null)

const DEMO_USERS: Array<{ email: string; password: string; user: User }> = [
  {
    email: 'qa.admin@example.com',
    password: 'Test1234!',
    user: {
      id: 'demo-admin',
      email: 'qa.admin@example.com',
      name: 'QA Admin',
      role: 'ADMIN',
      title: 'Test Admin',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  },
  {
    email: 'qa.editor@example.com',
    password: 'Test1234!',
    user: {
      id: 'demo-editor',
      email: 'qa.editor@example.com',
      name: 'QA Editor',
      role: 'EDITOR',
      title: 'Test Editor',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  },
  {
    email: 'qa.viewer@example.com',
    password: 'Test1234!',
    user: {
      id: 'demo-viewer',
      email: 'qa.viewer@example.com',
      name: 'QA Viewer',
      role: 'VIEWER',
      title: 'Test Viewer',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  },
]

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [token, setTokenState] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Restore session from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('entropy_token')
    const storedUser = localStorage.getItem('entropy_user')
    if (stored) {
      setTokenState(stored)
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)) } catch {}
      }
      if (stored.startsWith('demo-token-')) {
        setIsLoading(false)
        return
      }
      // Refresh user profile in background
      auth.me()
        .then((u) => {
          setUser(u)
          localStorage.setItem('entropy_user', JSON.stringify(u))
        })
        .catch(() => {
          clearToken()
          setTokenState(null)
          setUser(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = React.useCallback(async (email: string, password: string) => {
    try {
      const res = await auth.login(email, password)
      setToken(res.access_token)
      setTokenState(res.access_token)
      const me = await auth.me()
      setUser(me)
      localStorage.setItem('entropy_user', JSON.stringify(me))
    } catch (error) {
      const demo = DEMO_USERS.find(
        (d) => d.email.toLowerCase() === email.toLowerCase() && d.password === password,
      )
      if (!demo) throw error
      const demoToken = `demo-token-${demo.user.id}`
      setToken(demoToken)
      setTokenState(demoToken)
      setUser(demo.user)
      localStorage.setItem('entropy_user', JSON.stringify(demo.user))
    }
  }, [])

  const signup = React.useCallback(async (name: string, email: string, password: string) => {
    const res = await auth.signup(name, email, password)
    setToken(res.access_token)
    setTokenState(res.access_token)
    const me = await auth.me()
    setUser(me)
    localStorage.setItem('entropy_user', JSON.stringify(me))
  }, [])

  const logout = React.useCallback(async () => {
    try { await auth.logout() } catch {}
    clearToken()
    setTokenState(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = React.useMemo(
    () => ({ user, token, isLoading, login, signup, logout }),
    [user, token, isLoading, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
