"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, Globe } from "lucide-react";
import { authApi } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور قصيرة جداً"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSSOLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  // Fix B-F1: MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Fix B-F2 + B-F11: Handle SSO callback using exchange code; remove lang from deps
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/dashboard";
    const ssoError = params.get("sso_error");

    // Primary path: one-time exchange code (Redis-backed, never a real JWT in URL)
    const ssoCode = params.get("sso_code");
    if (ssoCode) {
      setSSOLoading(true);
      authApi.exchangeSsoCode(ssoCode)
        .then((res) => {
          setToken(res.data.access_token);
          router.replace(redirect);
        })
        .catch(() => setError("فشل تسجيل الدخول عبر SSO — رمز الجلسة منتهي أو غير صالح"))
        .finally(() => setSSOLoading(false));
      return;
    }

    // Fallback path: token in URL fragment (Redis unavailable at callback time)
    // Fragments are not sent to servers, but are visible in browser history.
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const match = hash.match(/[#&]token=([^&]+)/);
      if (match) {
        setToken(decodeURIComponent(match[1]));
        // Immediately replace URL to remove token from browser history
        router.replace(redirect);
        return;
      }
    }

    if (ssoError) {
      setError("فشل تسجيل الدخول عبر SSO");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — searchParams values are stable references

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(data.email, data.password);
      // Fix B-F1: Backend returns 202 with mfa_required=true — handle in success path, not catch
      if (response.data.mfa_required && response.data.session_token) {
        setMfaRequired(true);
        setSessionToken(response.data.session_token);
      } else if (response.data.access_token) {
        setToken(response.data.access_token);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(lang === "ar" ? "بيانات الدخول غير صحيحة" : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  // Fix B-F1: MFA verification handler
  const onMfaSubmit = async () => {
    if (mfaCode.length !== 6) {
      setError("رمز التحقق يجب أن يكون 6 أرقام");
      return;
    }
    setMfaLoading(true);
    setError(null);
    try {
      const response = await authApi.verifyMfa(sessionToken, mfaCode);
      setToken(response.data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "رمز التحقق غير صحيح أو منتهي الصلاحية");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleSSO = () => {
    setSSOLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get("redirect") || "/dashboard";
    window.location.href = `${apiBase}/auth/sso-start?redirect_path=${encodeURIComponent(redirectPath)}`;
  };

  const t = {
    title:       lang === "ar" ? "منصة تحليل المناقصات"        : "RFP Intelligence Platform",
    sso:         lang === "ar" ? "تسجيل الدخول عبر Entropy SSO" : "Sign in with Entropy SSO",
    or:          lang === "ar" ? "أو"                           : "or",
    email:       lang === "ar" ? "البريد الإلكتروني"            : "Email",
    password:    lang === "ar" ? "كلمة المرور"                  : "Password",
    signin:      lang === "ar" ? "تسجيل الدخول"                 : "Sign in",
    create:      lang === "ar" ? "إنشاء حساب"                   : "Create account",
    internal:    lang === "ar" ? "للاستخدام الداخلي فقط · Entropy.sa" : "Internal use only · Entropy.sa",
    advanced:    lang === "ar" ? "دخول المسؤول (متقدم)"         : "Admin login (advanced)",
    mfaTitle:    lang === "ar" ? "التحقق بخطوتين"               : "Two-Factor Verification",
    mfaLabel:    lang === "ar" ? "رمز التحقق (6 أرقام)"         : "Verification Code (6 digits)",
    mfaVerify:   lang === "ar" ? "تحقق"                         : "Verify",
    mfaBack:     lang === "ar" ? "رجوع"                         : "Back",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white font-bold text-xl mb-4">
            E
          </div>
          <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-100">Entropy</h1>
          <p className="text-body-sm text-neutral-500 mt-1">{t.title}</p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-md px-3 py-2 text-body-sm" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}

          {/* Fix B-F1: MFA step — rendered when backend returns 202 mfa_required */}
          {mfaRequired ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-h4 font-semibold text-neutral-800">{t.mfaTitle}</p>
                <p className="text-body-sm text-neutral-500 mt-1">
                  {lang === "ar"
                    ? "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة"
                    : "Enter the 6-digit code from your authenticator app"}
                </p>
              </div>
              <div>
                <label htmlFor="mfa-code" className="block text-body-sm font-medium text-neutral-700 mb-1">
                  {t.mfaLabel}
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && onMfaSubmit()}
                  className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  dir="ltr"
                />
              </div>
              <button
                onClick={onMfaSubmit}
                disabled={mfaLoading || mfaCode.length !== 6}
                className={cn(
                  "w-full flex items-center justify-center gap-2 h-9 rounded-md bg-primary-600 text-white font-semibold text-body-sm",
                  "hover:bg-primary-700 transition-colors disabled:opacity-60"
                )}
              >
                {mfaLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.mfaVerify}
              </button>
              <button
                onClick={() => { setMfaRequired(false); setMfaCode(""); setError(null); }}
                className="w-full text-caption text-neutral-400 hover:text-neutral-600 underline text-center"
              >
                {t.mfaBack}
              </button>
            </div>
          ) : (
            <>
              {/* SSO button */}
              <button
                onClick={handleSSO}
                disabled={ssoLoading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary-600 text-white font-semibold text-body-sm",
                  "hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2",
                  "transition-colors disabled:opacity-60"
                )}
              >
                {ssoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sso}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-caption text-neutral-400">{t.or}</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>

              {/* Toggle admin fallback */}
              {!showFallback ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowFallback(true)}
                    className="w-full text-caption text-neutral-400 hover:text-neutral-600 underline text-center"
                  >
                    {t.advanced}
                  </button>
                  <Link
                    href="/signup"
                    className="block w-full text-caption text-neutral-500 hover:text-neutral-700 underline text-center"
                  >
                    {t.create}
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <div>
                    <label htmlFor="email" className="block text-body-sm font-medium text-neutral-700 mb-1">{t.email}</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      {...register("email")}
                      className={cn(
                        "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent",
                        errors.email ? "border-danger-500" : "border-neutral-300"
                      )}
                    />
                    {errors.email && <p className="text-caption text-danger-600 mt-1">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-body-sm font-medium text-neutral-700 mb-1">{t.password}</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      {...register("password")}
                      className={cn(
                        "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent",
                        errors.password ? "border-danger-500" : "border-neutral-300"
                      )}
                    />
                    {errors.password && <p className="text-caption text-danger-600 mt-1">{errors.password.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-9 rounded-md bg-primary-600 text-white font-semibold text-body-sm",
                      "hover:bg-primary-700 transition-colors disabled:opacity-60"
                    )}
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.signin}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-caption text-neutral-400">{t.internal}</p>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="inline-flex items-center gap-1.5 text-caption text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label={`Switch to ${lang === "ar" ? "English" : "Arabic"}`}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden />
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </div>
    </div>
  );
}
