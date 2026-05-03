"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { proposalApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Download, FileText, File, CheckCircle2, Loader2, AlertCircle, Trophy, XCircle } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

const OUTCOMES = [
  { value: "WON",       label: "فوز",            icon: Trophy,    color: "text-success-600 bg-success-50 border-success-200" },
  { value: "LOST",      label: "خسارة",           icon: XCircle,   color: "text-danger-600 bg-danger-50 border-danger-200" },
  { value: "CANCELLED", label: "إلغاء المناقصة",  icon: AlertCircle, color: "text-neutral-600 bg-neutral-50 border-neutral-200" },
  { value: "PENDING",   label: "في الانتظار",     icon: CheckCircle2, color: "text-warning-600 bg-warning-50 border-warning-200" },
] as const;

export default function ExportPage({ params }: Props) {
  const { id } = use(params);
  const [exportFormat, setExportFormat] = useState<"docx" | "pdf">("docx");
  const [exportLang, setExportLang] = useState<"ar" | "en" | "both">("ar");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [outcomeUpdating, setOutcomeUpdating] = useState(false);
  const [outcomeSuccess, setOutcomeSuccess] = useState(false);

  const { data: proposal, mutate } = useSWR(
    `proposal-${id}`,
    () => proposalApi.get(id).then((r) => r.data)
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
      const response = await fetch(`${apiBase}/rfps/${id}/proposal/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: exportFormat, language: exportLang }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${id}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("فشل التصدير، يرجى المحاولة مرة أخرى");
    } finally {
      setExporting(false);
    }
  };

  const handleOutcomeUpdate = async (outcome: string) => {
    setOutcomeUpdating(true);
    try {
      await proposalApi.updateOutcome(id, outcome);
      await mutate();
      setOutcomeSuccess(true);
      setTimeout(() => setOutcomeSuccess(false), 2000);
    } finally {
      setOutcomeUpdating(false);
    }
  };

  const hasUngroundedClaims = proposal?.sections?.some((s: any) => s.hasUngroundedClaims);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Ungrounded claims warning */}
      {hasUngroundedClaims && (
        <div className="flex items-start gap-3 bg-warning-50 border border-warning-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-body-sm font-semibold text-warning-800">تحذير: ادعاءات غير موثقة</p>
            <p className="text-body-sm text-warning-700 mt-0.5">
              بعض أقسام المقترح تحتوي على ادعاءات غير مدعومة بمصادر موثقة.
              يُنصح بمراجعة هذه الأقسام قبل التصدير.
            </p>
          </div>
        </div>
      )}

      {/* Export options */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm space-y-5">
        <h2 className="text-h3 font-semibold text-neutral-900">تصدير المقترح</h2>

        {/* Format */}
        <div>
          <label className="block text-body-sm font-medium text-neutral-700 mb-2">صيغة الملف</label>
          <div className="flex gap-3">
            {[
              { value: "docx", label: "Word (DOCX)", Icon: FileText },
              { value: "pdf",  label: "PDF",          Icon: File },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setExportFormat(value as "docx" | "pdf")}
                className={cn(
                  "flex-1 h-12 flex items-center justify-center gap-2 rounded-lg border text-body-sm font-medium transition-colors",
                  exportFormat === value
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-body-sm font-medium text-neutral-700 mb-2">لغة التصدير</label>
          <div className="flex gap-3">
            {[
              { value: "ar",   label: "عربي فقط" },
              { value: "en",   label: "إنجليزي فقط" },
              { value: "both", label: "ثنائي اللغة" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setExportLang(value as "ar" | "en" | "both")}
                className={cn(
                  "flex-1 h-9 rounded-md border text-body-sm font-medium transition-colors",
                  exportLang === value
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {exportError && (
          <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-md px-3 py-2 text-body-sm" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {exportError}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-primary-600 text-white font-semibold text-body-sm hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {exporting
            ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> جاري التصدير...</>
            : <><Download className="h-4 w-4" aria-hidden /> تصدير</>
          }
        </button>
      </div>

      {/* Outcome tracking */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-neutral-900">نتيجة المناقصة</h2>
          {outcomeSuccess && (
            <span className="text-caption text-success-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              تم الحفظ
            </span>
          )}
        </div>
        <p className="text-body-sm text-neutral-500">
          سجّل نتيجة المناقصة لتحسين التحليلات ونماذج الفوز/الخسارة.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {OUTCOMES.map(({ value, label, icon: Icon, color }) => {
            const isSelected = proposal?.outcome === value;
            return (
              <button
                key={value}
                onClick={() => handleOutcomeUpdate(value)}
                disabled={outcomeUpdating}
                className={cn(
                  "h-12 flex items-center justify-center gap-2 rounded-lg border text-body-sm font-medium transition-colors disabled:opacity-60",
                  isSelected ? color : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Export history (stub) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-h3 font-semibold text-neutral-900 mb-4">سجل التصدير</h2>
        <div className="text-center py-6">
          <File className="h-8 w-8 text-neutral-200 mx-auto mb-2" aria-hidden />
          <p className="text-body-sm text-neutral-400">لا توجد ملفات مصدّرة بعد</p>
        </div>
      </div>
    </div>
  );
}
