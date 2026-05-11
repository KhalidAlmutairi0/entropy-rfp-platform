'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/providers/language-provider'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Building2, Loader2, ArrowLeft, AlertCircle } from 'lucide-react'

type AuthStep = 'credentials' | 'mfa'

const DEMO_ACCOUNTS = [
  { email: 'admin@entropy.sa', password: 'Admin@1234', role: 'Admin' },
  { email: 'ahmad@entropy.sa', password: 'Ahmad@2024', role: 'BD Manager' },
]

export default function LoginPage() {
  const { t, direction } = useLanguage()
  const { login } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('credentials')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      // MFA required — backend returns 200 with mfa_required flag or 401
      // For now surface error; MFA flow is a future feature
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsLoading(false)
    router.push('/dashboard')
  }

  if (step === 'mfa') {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <Button
            variant="ghost"
            size="sm"
            className={`absolute top-4 ${direction === 'rtl' ? 'right-4' : 'left-4'} gap-2`}
            onClick={() => setStep('credentials')}
          >
            <ArrowLeft className={`h-4 w-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            Back
          </Button>
          <CardTitle className="text-2xl font-bold">{t('auth.mfaTitle')}</CardTitle>
          <CardDescription>{t('auth.mfaDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMfaSubmit} className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={mfaCode} onChange={(value) => setMfaCode(value)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || mfaCode.length !== 6}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.verify')}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t('auth.login')}</CardTitle>
        <CardDescription>
          {t('auth.noAccount')}{' '}
          <Link href="/signup" className="text-primary hover:underline">
            {t('auth.signup')}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full gap-2" disabled={isLoading}>
          <Building2 className="h-4 w-4" />
          {t('auth.ssoLogin')}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t('auth.orContinueWith')}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-2 text-foreground">Test accounts</p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="block w-full text-left rounded px-2 py-1 hover:bg-muted"
                onClick={() => {
                  setEmail(acc.email)
                  setPassword(acc.password)
                }}
              >
                <span className="text-foreground font-medium">{acc.role}</span>
                {' — '}
                <span className="font-mono">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@entropy.sa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Checkbox id="remember" />
            <Label htmlFor="remember" className="text-sm font-normal">
              {t('auth.rememberMe')}
            </Label>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('auth.login')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
