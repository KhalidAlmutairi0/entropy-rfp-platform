"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { User, Bell, Shield, Globe, Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

type SettingsTab = "profile" | "notifications" | "security" | "workspace";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "الملف الشخصي",  icon: User   },
  { id: "notifications", label: "الإشعارات",      icon: Bell   },
  { id: "security",      label: "الأمان",          icon: Shield },
  { id: "workspace",     label: "مساحة العمل",    icon: Globe  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({ name: "", email: "", preferredLanguage: "ar" as "ar" | "en", preferredTimezone: "Asia/Riyadh" });
  const [notifPrefs, setNotifPrefs] = useState({ analysisComplete: true, decisionReady: true, actionRequired: true, reviewRequest: true, email: false });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await new Promise((r) => setTimeout(r, 600)); // simulate API call
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("فشل الحفظ، يرجى المحاولة مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-h1 font-semibold text-neutral-900">الإعدادات</h1>

        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <nav className="w-48 shrink-0 space-y-1" aria-label="تبويبات الإعدادات">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-body-sm font-medium transition-colors text-start",
                  activeTab === id
                    ? "bg-primary-50 text-primary-700"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
                aria-current={activeTab === id ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4 shrink-0", activeTab === id ? "text-primary-600" : "text-neutral-400")} aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 bg-white border border-neutral-200 rounded-lg shadow-sm">
            <div className="p-6 space-y-5">
              {activeTab === "profile" && (
                <>
                  <h2 className="text-h3 font-semibold text-neutral-900">الملف الشخصي</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-body-sm font-medium text-neutral-700 mb-1">الاسم الكامل</label>
                      <input
                        id="name"
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                        className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                        placeholder="الاسم الكامل"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-body-sm font-medium text-neutral-700 mb-1">البريد الإلكتروني</label>
                      <input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                        className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                        placeholder="user@entropy.sa"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium text-neutral-700 mb-1">اللغة المفضلة</label>
                      <div className="flex gap-2">
                        {[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }].map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setProfile((p) => ({ ...p, preferredLanguage: value as "ar" | "en" }))}
                            className={cn(
                              "flex-1 h-9 rounded-md border text-body-sm font-medium transition-colors",
                              profile.preferredLanguage === value
                                ? "border-primary-600 bg-primary-50 text-primary-700"
                                : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="timezone" className="block text-body-sm font-medium text-neutral-700 mb-1">المنطقة الزمنية</label>
                      <select
                        id="timezone"
                        value={profile.preferredTimezone}
                        onChange={(e) => setProfile((p) => ({ ...p, preferredTimezone: e.target.value }))}
                        className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                      >
                        <option value="Asia/Riyadh">توقيت الرياض (UTC+3)</option>
                        <option value="Asia/Dubai">توقيت دبي (UTC+4)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "notifications" && (
                <>
                  <h2 className="text-h3 font-semibold text-neutral-900">تفضيلات الإشعارات</h2>
                  <div className="space-y-3">
                    {[
                      { key: "analysisComplete", label: "اكتمال التحليل",       description: "عند الانتهاء من تحليل مناقصة" },
                      { key: "decisionReady",    label: "القرار جاهز",          description: "عند صدور قرار جديد" },
                      { key: "actionRequired",   label: "إجراء مطلوب",          description: "عند الحاجة لتدخل يدوي" },
                      { key: "reviewRequest",    label: "طلب مراجعة",           description: "عند طلب مراجعة المقترح" },
                      { key: "email",            label: "إشعارات البريد الإلكتروني", description: "استقبال الإشعارات عبر البريد" },
                    ].map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between py-2.5 border-b border-neutral-50 last:border-0">
                        <div>
                          <p className="text-body-sm font-medium text-neutral-800">{label}</p>
                          <p className="text-caption text-neutral-500">{description}</p>
                        </div>
                        <button
                          role="switch"
                          aria-checked={notifPrefs[key as keyof typeof notifPrefs]}
                          onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key as keyof typeof notifPrefs] }))}
                          className={cn(
                            "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2",
                            notifPrefs[key as keyof typeof notifPrefs] ? "bg-primary-600" : "bg-neutral-200"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                            notifPrefs[key as keyof typeof notifPrefs] ? "translate-x-4" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "security" && (
                <>
                  <h2 className="text-h3 font-semibold text-neutral-900">الأمان</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="current-pass" className="block text-body-sm font-medium text-neutral-700 mb-1">كلمة المرور الحالية</label>
                      <div className="relative">
                        <input
                          id="current-pass"
                          type={showPassword ? "text" : "password"}
                          value={passwords.current}
                          onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                          className="w-full h-9 rounded-md border border-neutral-300 px-3 pe-9 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                          aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="new-pass" className="block text-body-sm font-medium text-neutral-700 mb-1">كلمة المرور الجديدة</label>
                      <input
                        id="new-pass"
                        type="password"
                        value={passwords.next}
                        onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                        className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-pass" className="block text-body-sm font-medium text-neutral-700 mb-1">تأكيد كلمة المرور</label>
                      <input
                        id="confirm-pass"
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                        className={cn(
                          "w-full h-9 rounded-md border px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600",
                          passwords.confirm && passwords.next !== passwords.confirm
                            ? "border-danger-400 focus:ring-danger-500"
                            : "border-neutral-300"
                        )}
                        dir="ltr"
                      />
                      {passwords.confirm && passwords.next !== passwords.confirm && (
                        <p className="text-caption text-danger-600 mt-1">كلمتا المرور غير متطابقتين</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-100">
                      <p className="text-body-sm font-medium text-neutral-700 mb-2">التحقق بخطوتين (MFA)</p>
                      <p className="text-caption text-neutral-500 mb-3">يُضيف طبقة أمان إضافية لحسابك</p>
                      <button className="h-8 px-3 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                        تفعيل MFA
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "workspace" && (
                <>
                  <h2 className="text-h3 font-semibold text-neutral-900">إعدادات مساحة العمل</h2>
                  <div className="space-y-4">
                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-1">
                      <p className="text-body-sm font-medium text-neutral-700">المؤسسة</p>
                      <p className="text-h4 font-semibold text-neutral-900">Entropy.sa</p>
                      <p className="text-caption text-neutral-500">للاستخدام الداخلي فقط</p>
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium text-neutral-700 mb-2">نماذج الذكاء الاصطناعي المفضلة</label>
                      <div className="space-y-2">
                        {[
                          { label: "النموذج الأساسي", value: "Claude Sonnet 4" },
                          { label: "النموذج الاحتياطي", value: "GPT-4o" },
                          { label: "نموذج التضمين", value: "Cohere Embed v3 Multilingual" },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                            <span className="text-body-sm text-neutral-700">{label}</span>
                            <span className="text-body-sm text-neutral-500 font-mono text-caption">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Save feedback */}
              {error && (
                <div className="flex items-center gap-2 text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2 text-body-sm" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-3">
              {saved && (
                <span className="text-caption text-success-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  تم الحفظ
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-5 flex items-center gap-2 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                <Save className="h-4 w-4" aria-hidden />
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
