"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FileUploader, FileEntry } from "@/components/file-uploader";
import { rfpApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

type Step = "upload" | "metadata" | "confirm";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload",   label: "رفع الملفات" },
  { id: "metadata", label: "بيانات المناقصة" },
  { id: "confirm",  label: "مراجعة وتأكيد" },
];

const STEP_INDEX: Record<Step, number> = { upload: 0, metadata: 1, confirm: 2 };

export default function UploadPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [files, setFiles] = useState<FileEntry[]>([]);
  // Fix B-F8: Language values must match backend enum: AR, EN, MIXED (not "ar"/"en"/"bilingual")
  const [metadata, setMetadata] = useState({
    titleAr: "",
    titleEn: "",
    agency: "",
    tenderNumber: "",
    deadline: "",
    estimatedValueSar: "",
    language: "AR" as "AR" | "EN" | "MIXED",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canProceedUpload = files.length > 0 && files.some((f) => f.fileType === "MAIN");
  const canProceedMetadata = metadata.titleAr.trim().length >= 3 || metadata.titleEn.trim().length >= 3;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      files.forEach((entry) => {
        formData.append("files", entry.file);
      });
      formData.append("file_types", files.map((entry) => entry.fileType).join(","));
      if (metadata.titleAr) formData.append("title_ar", metadata.titleAr);
      if (metadata.titleEn) formData.append("title_en", metadata.titleEn);
      if (metadata.agency) formData.append("agency", metadata.agency);
      if (metadata.tenderNumber) formData.append("tender_number", metadata.tenderNumber);
      if (metadata.deadline) formData.append("deadline", metadata.deadline);
      if (metadata.estimatedValueSar) formData.append("estimated_value_sar", metadata.estimatedValueSar);
      formData.append("language", metadata.language);

      const response = await rfpApi.upload(formData);
      const rfpId = response.data.id;
      await rfpApi.analyze(rfpId);
      router.push(`/rfps/${rfpId}/processing`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "حدث خطأ أثناء الرفع، يرجى المحاولة مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIdx = STEP_INDEX[currentStep];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-h1 font-semibold text-neutral-900">رفع مناقصة جديدة</h1>
          <p className="text-body-sm text-neutral-500 mt-1">ارفع ملفات المناقصة لبدء التحليل الآلي</p>
        </div>

        {/* Step indicator */}
        <nav aria-label="خطوات الرفع">
          <ol className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const isComplete = i < stepIdx;
              const isActive = i === stepIdx;
              return (
                <li key={step.id} className="flex items-center flex-1">
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
                    <span className="text-body-sm font-medium hidden sm:block">{step.label}</span>
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
          {currentStep === "upload" && (
            <div className="space-y-4">
              <h2 className="text-h3 font-semibold text-neutral-800">رفع ملفات المناقصة</h2>
              <p className="text-body-sm text-neutral-500">
                ارفع ملف المناقصة الرئيسي والملاحق. يجب تحديد نوع كل ملف.
              </p>
              <FileUploader onFilesChange={setFiles} />
              {files.length > 0 && !files.some((f) => f.fileType === "MAIN") && (
                <p className="text-caption text-warning-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  يجب تحديد ملف رئيسي واحد على الأقل
                </p>
              )}
            </div>
          )}

          {currentStep === "metadata" && (
            <div className="space-y-4">
              <h2 className="text-h3 font-semibold text-neutral-800">بيانات المناقصة</h2>
              <p className="text-body-sm text-neutral-500">هذه البيانات تُستخدم لتحسين التحليل (يمكن تركها فارغة)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="titleAr" className="block text-body-sm font-medium text-neutral-700 mb-1">العنوان بالعربية</label>
                  <input
                    id="titleAr"
                    type="text"
                    value={metadata.titleAr}
                    onChange={(e) => setMetadata((m) => ({ ...m, titleAr: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="عنوان المناقصة بالعربية"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label htmlFor="titleEn" className="block text-body-sm font-medium text-neutral-700 mb-1">Title in English</label>
                  <input
                    id="titleEn"
                    type="text"
                    value={metadata.titleEn}
                    onChange={(e) => setMetadata((m) => ({ ...m, titleEn: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="Tender title in English"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label htmlFor="agency" className="block text-body-sm font-medium text-neutral-700 mb-1">الجهة المُصدِرة</label>
                  <input
                    id="agency"
                    type="text"
                    value={metadata.agency}
                    onChange={(e) => setMetadata((m) => ({ ...m, agency: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="مثال: وزارة الصحة"
                  />
                </div>
                <div>
                  <label htmlFor="tenderNumber" className="block text-body-sm font-medium text-neutral-700 mb-1">رقم المناقصة</label>
                  <input
                    id="tenderNumber"
                    type="text"
                    value={metadata.tenderNumber}
                    onChange={(e) => setMetadata((m) => ({ ...m, tenderNumber: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="مثال: MOH-2024-001"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label htmlFor="deadline" className="block text-body-sm font-medium text-neutral-700 mb-1">تاريخ الإغلاق</label>
                  <input
                    id="deadline"
                    type="date"
                    value={metadata.deadline}
                    onChange={(e) => setMetadata((m) => ({ ...m, deadline: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label htmlFor="estimatedValue" className="block text-body-sm font-medium text-neutral-700 mb-1">القيمة التقديرية (ريال)</label>
                  <input
                    id="estimatedValue"
                    type="number"
                    value={metadata.estimatedValueSar}
                    onChange={(e) => setMetadata((m) => ({ ...m, estimatedValueSar: e.target.value }))}
                    className="w-full h-9 rounded-md border border-neutral-300 px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    placeholder="مثال: 5000000"
                    min={0}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-neutral-700 mb-2">لغة الوثيقة</label>
                <div className="flex gap-3">
                  {[
                    { value: "AR",    label: "عربي" },
                    { value: "EN",    label: "إنجليزي" },
                    { value: "MIXED", label: "ثنائي اللغة" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setMetadata((m) => ({ ...m, language: value as "AR" | "EN" | "MIXED" }))}
                      className={cn(
                        "flex-1 h-9 rounded-md border text-body-sm font-medium transition-colors",
                        metadata.language === value
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === "confirm" && (
            <div className="space-y-5">
              <h2 className="text-h3 font-semibold text-neutral-800">مراجعة وتأكيد</h2>

              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100 space-y-2">
                <p className="text-body-sm font-medium text-neutral-700">الملفات المرفقة</p>
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="text-body-sm text-neutral-600 flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success-500 shrink-0" aria-hidden />
                      {f.file.name}
                      <span className="text-caption text-neutral-400">({f.fileType})</span>
                    </li>
                  ))}
                </ul>
              </div>

              {(metadata.titleAr || metadata.agency || metadata.tenderNumber || metadata.deadline) && (
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100 space-y-2">
                  <p className="text-body-sm font-medium text-neutral-700">البيانات المدخلة</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {metadata.titleAr && <><dt className="text-caption text-neutral-500">العنوان (عر)</dt><dd className="text-body-sm text-neutral-700">{metadata.titleAr}</dd></>}
                    {metadata.agency && <><dt className="text-caption text-neutral-500">الجهة</dt><dd className="text-body-sm text-neutral-700">{metadata.agency}</dd></>}
                    {metadata.tenderNumber && <><dt className="text-caption text-neutral-500">رقم المناقصة</dt><dd className="text-body-sm text-neutral-700 dir-ltr">{metadata.tenderNumber}</dd></>}
                    {metadata.deadline && <><dt className="text-caption text-neutral-500">تاريخ الإغلاق</dt><dd className="text-body-sm text-neutral-700">{metadata.deadline}</dd></>}
                  </dl>
                </div>
              )}

              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
                <p className="text-body-sm text-primary-700">
                  بعد التأكيد سيبدأ التحليل الآلي ويستغرق عادةً 2-5 دقائق.
                  ستتلقى إشعاراً عند اكتمال التحليل.
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
              if (currentStep === "metadata") setCurrentStep("upload");
              else if (currentStep === "confirm") setCurrentStep("metadata");
              else router.push("/dashboard");
            }}
            className="h-9 px-4 flex items-center gap-2 rounded-lg border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            {currentStep === "upload" ? "إلغاء" : "السابق"}
          </button>

          {currentStep !== "confirm" ? (
            <button
              onClick={() => {
                if (currentStep === "upload") setCurrentStep("metadata");
                else setCurrentStep("confirm");
              }}
              disabled={currentStep === "upload" ? !canProceedUpload : !canProceedMetadata}
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
              {submitting ? "جاري الرفع..." : "رفع وتحليل"}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
