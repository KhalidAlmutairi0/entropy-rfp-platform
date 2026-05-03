"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { proposalApi, type SectionDef } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  ListOrdered,
} from "lucide-react";

type Step = "info" | "agenda" | "confirm";
type AgendaMode = "ai" | "manual";

const STEPS: { id: Step; label: string }[] = [
  { id: "info",    label: "معلومات المقترح" },
  { id: "agenda",  label: "هيكل المقترح" },
  { id: "confirm", label: "مراجعة وإنشاء" },
];
const STEP_INDEX: Record<Step, number> = { info: 0, agenda: 1, confirm: 2 };

const DEFAULT_MANUAL_SECTIONS: SectionDef[] = [
  { title_ar: "ملخص تنفيذي",       title_en: "Executive Summary" },
  { title_ar: "نبذة عن الشركة",     title_en: "Company Profile" },
  { title_ar: "المنهجية المقترحة",  title_en: "Proposed Methodology" },
  { title_ar: "خطة المشروع",        title_en: "Project Plan" },
  { title_ar: "الفريق والمؤهلات",   title_en: "Team & Qualifications" },
  { title_ar: "التسعير",            title_en: "Pricing", is_locked: true },
];

export default function DirectProposalPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("info");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("ai");
  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_MANUAL_SECTIONS);
  const [newTitleAr, setNewTitleAr] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const stepIdx = STEP_INDEX[step];
  const canProceedInfo = title.trim().length >= 3;
  const canProceedAgenda = agendaMode === "ai" || sections.length > 0;

  const addSection = () => {
    if (!newTitleAr.trim() && !newTitleEn.trim()) return;
    setSections((s) => [...s, { title_ar: newTitleAr, title_en: newTitleEn }]);
    setNewTitleAr("");
    setNewTitleEn("");
  };

  const removeSection = (idx: number) => {
    setSections((s) => s.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await proposalApi.createDirect({
        title: title.trim(),
        description: description.trim() || undefined,
        use_ai_agenda: agendaMode === "ai",
        custom_sections: agendaMode === "manual" ? sections : undefined,
      });
      const rfpId: string = res.data.rfp_id;
      router.push(`/rfps/${rfpId}/proposal`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "حدث خطأ أثناء إنشاء المقترح");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-h1 font-semibold text-neutral-900">مقترح مباشر</h1>
          <p className="text-body-sm text-neutral-500 mt-1">
            إنشاء مقترح بدون مناقصة — مناسب للعروض الاستباقية والشراكات المباشرة
          </p>
        </div>

        {/* Steps */}
        <nav aria-label="خطوات الإنشاء">
          <ol className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const isComplete = i < stepIdx;
              const isActive = i === stepIdx;
              return (
                <li key={s.id} className="flex items-center flex-1">
                  <div className={cn(
                    "flex items-center gap-2 min-w-0",
                    isActive && "text-primary-700",
                    isComplete && "text-success-700",
                    !isActive && !isComplete && "text-neutral-400"
                  )}>
                    <span className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-body-sm font-semibold shrink-0 border-2",
                      isActive ? "border-primary-600 bg-primary-50 text-primary-700"
                        : isComplete ? "border-success-500 bg-success-50 text-success-700"
                        : "border-neutral-200 bg-white text-neutral-400"
                    )}>
                      {isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    <span className="text-body-sm font-medium hidden sm:block">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-px mx-3", i < stepIdx ? "bg-success-300" : "bg-neutral-200")} aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">

          {/* Step 1: Info */}
          {step === "info" && (
            <div className="space-y-4">
              <h2 className="text-h3 font-semibold text-neutral-800">معلومات المقترح</h2>
              <div>
                <label htmlFor="propTitle" className="block text-body-sm font-medium text-neutral-700 mb-1">
                  عنوان المقترح <span className="text-danger-600">*</span>
                </label>
                <input
                  id="propTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="مثال: مقترح تطوير منصة بيانات لوزارة الصحة"
                  dir="rtl"
                />
              </div>
              <div>
                <label htmlFor="propDesc" className="block text-body-sm font-medium text-neutral-700 mb-1">
                  نبذة مختصرة <span className="text-neutral-400">(اختياري)</span>
                </label>
                <textarea
                  id="propDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
                  placeholder="وصف موجز لهدف المقترح والعميل المستهدف..."
                  dir="rtl"
                />
              </div>
            </div>
          )}

          {/* Step 2: Agenda */}
          {step === "agenda" && (
            <div className="space-y-5">
              <h2 className="text-h3 font-semibold text-neutral-800">هيكل المقترح</h2>
              <p className="text-body-sm text-neutral-500">اختر طريقة بناء أقسام المقترح</p>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAgendaMode("ai")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center transition-colors",
                    agendaMode === "ai"
                      ? "border-primary-600 bg-primary-50"
                      : "border-neutral-200 hover:bg-neutral-50"
                  )}
                >
                  <Sparkles className={cn("h-5 w-5", agendaMode === "ai" ? "text-primary-600" : "text-neutral-400")} aria-hidden />
                  <span className={cn("text-body-sm font-semibold", agendaMode === "ai" ? "text-primary-700" : "text-neutral-700")}>
                    اقتراح ذكي
                  </span>
                  <span className="text-caption text-neutral-500">يقترح النظام الأقسام من القالب الأنسب</span>
                </button>
                <button
                  onClick={() => setAgendaMode("manual")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center transition-colors",
                    agendaMode === "manual"
                      ? "border-primary-600 bg-primary-50"
                      : "border-neutral-200 hover:bg-neutral-50"
                  )}
                >
                  <ListOrdered className={cn("h-5 w-5", agendaMode === "manual" ? "text-primary-600" : "text-neutral-400")} aria-hidden />
                  <span className={cn("text-body-sm font-semibold", agendaMode === "manual" ? "text-primary-700" : "text-neutral-700")}>
                    تخصيص يدوي
                  </span>
                  <span className="text-caption text-neutral-500">حدد أقسام المقترح بنفسك</span>
                </button>
              </div>

              {/* Manual section builder */}
              {agendaMode === "manual" && (
                <div className="space-y-3">
                  <p className="text-body-sm font-medium text-neutral-700">الأقسام ({sections.length})</p>
                  <ul className="space-y-2">
                    {sections.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-md border border-neutral-100"
                      >
                        <span className="text-caption text-neutral-400 w-5 text-center shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-medium text-neutral-800 truncate">{s.title_ar}</p>
                          {s.title_en && <p className="text-caption text-neutral-400 truncate">{s.title_en}</p>}
                        </div>
                        {s.is_locked && (
                          <span className="text-caption bg-warning-50 text-warning-700 border border-warning-200 rounded px-1.5">مقفل</span>
                        )}
                        <button
                          onClick={() => removeSection(i)}
                          className="text-neutral-400 hover:text-danger-600 transition-colors shrink-0"
                          aria-label="حذف القسم"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Add section */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newTitleAr}
                      onChange={(e) => setNewTitleAr(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSection()}
                      className="flex-1 h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="اسم القسم بالعربية"
                      dir="rtl"
                    />
                    <input
                      type="text"
                      value={newTitleEn}
                      onChange={(e) => setNewTitleEn(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSection()}
                      className="flex-1 h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                      placeholder="Section name in English"
                      dir="ltr"
                    />
                    <button
                      onClick={addSection}
                      disabled={!newTitleAr.trim() && !newTitleEn.trim()}
                      className="h-9 w-9 flex items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-40"
                      aria-label="إضافة قسم"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              )}

              {agendaMode === "ai" && (
                <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                  <p className="text-body-sm text-primary-700">
                    سيختار النظام أفضل قالب لنوع المقترح ويقترح الأقسام تلقائيًا. يمكنك تعديل الأقسام بعد الإنشاء.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && (
            <div className="space-y-5">
              <h2 className="text-h3 font-semibold text-neutral-800">مراجعة وإنشاء</h2>

              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100 space-y-2">
                <p className="text-body-sm font-medium text-neutral-700">معلومات المقترح</p>
                <dl className="space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-caption text-neutral-500 w-20 shrink-0">العنوان</dt>
                    <dd className="text-body-sm text-neutral-800">{title}</dd>
                  </div>
                  {description && (
                    <div className="flex gap-2">
                      <dt className="text-caption text-neutral-500 w-20 shrink-0">النبذة</dt>
                      <dd className="text-body-sm text-neutral-600">{description}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="text-caption text-neutral-500 w-20 shrink-0">الأقسام</dt>
                    <dd className="text-body-sm text-neutral-800">
                      {agendaMode === "ai"
                        ? "اقتراح ذكي من النظام"
                        : `${sections.length} قسم مخصص`}
                    </dd>
                  </div>
                </dl>
              </div>

              {agendaMode === "manual" && sections.length > 0 && (
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                  <p className="text-body-sm font-medium text-neutral-700 mb-2">الأقسام المحددة</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    {sections.map((s, i) => (
                      <li key={i} className="text-body-sm text-neutral-600">{s.title_ar}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                <p className="text-body-sm text-primary-700">
                  سيتم إنشاء المقترح فورًا وستُنشأ أقسامه في الخلفية. يمكنك البدء في التحرير مباشرة.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-md px-3 py-2 text-body-sm" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              if (step === "agenda") setStep("info");
              else if (step === "confirm") setStep("agenda");
              else router.push("/dashboard");
            }}
            className="h-9 px-4 flex items-center gap-2 rounded-lg border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            {step === "info" ? "إلغاء" : "السابق"}
          </button>

          {step !== "confirm" ? (
            <button
              onClick={() => {
                if (step === "info") setStep("agenda");
                else setStep("confirm");
              }}
              disabled={step === "info" ? !canProceedInfo : !canProceedAgenda}
              className="h-9 px-4 flex items-center gap-2 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              التالي
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="h-9 px-5 flex items-center gap-2 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {submitting ? "جاري الإنشاء..." : "إنشاء المقترح"}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
