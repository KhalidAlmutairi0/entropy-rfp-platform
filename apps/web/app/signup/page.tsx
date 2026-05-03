"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  name: z.string().min(2, "الاسم قصير جداً"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.signup(data.name, data.email, data.password);
      setToken(response.data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError("هذا البريد الإلكتروني مسجل مسبقاً");
      } else {
        setError("تعذر إنشاء الحساب حالياً");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white font-bold text-xl mb-4">
            E
          </div>
          <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-100">إنشاء حساب</h1>
          <p className="text-body-sm text-neutral-500 mt-1">ابدأ باستخدام منصة تحليل المناقصات</p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-md px-3 py-2 text-body-sm" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-body-sm font-medium text-neutral-700 mb-1">الاسم</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                {...register("name")}
                className={cn(
                  "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent",
                  errors.name ? "border-danger-500" : "border-neutral-300"
                )}
              />
              {errors.name && <p className="text-caption text-danger-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-body-sm font-medium text-neutral-700 mb-1">البريد الإلكتروني</label>
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
              <label htmlFor="password" className="block text-body-sm font-medium text-neutral-700 mb-1">كلمة المرور</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                className={cn(
                  "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent",
                  errors.password ? "border-danger-500" : "border-neutral-300"
                )}
              />
              {errors.password && <p className="text-caption text-danger-600 mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-body-sm font-medium text-neutral-700 mb-1">تأكيد كلمة المرور</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                className={cn(
                  "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent",
                  errors.confirmPassword ? "border-danger-500" : "border-neutral-300"
                )}
              />
              {errors.confirmPassword && <p className="text-caption text-danger-600 mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-primary-600 text-white font-semibold text-body-sm hover:bg-primary-700 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء حساب
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/login" className="text-caption text-neutral-500 hover:text-neutral-700 underline">
            لديك حساب بالفعل؟ تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
