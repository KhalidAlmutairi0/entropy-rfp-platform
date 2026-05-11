"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { rfpApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DeckStatus, RFP } from "@/lib/types";

interface DeckPageProps {
  params: { id: string };
}

const DECK_STATUS_LABELS: Record<DeckStatus, { ar: string; color: string }> = {
  PENDING:    { ar: "في الانتظار",    color: "text-neutral-500"  },
  GENERATING: { ar: "جارٍ التوليد…",  color: "text-warning-700"  },
  READY:      { ar: "جاهز للتنزيل",  color: "text-success-700"  },
  FAILED:     { ar: "فشل التوليد",   color: "text-danger-700"   },
};

export default function DeckPage({ params }: DeckPageProps) {
  const { id } = params;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rfp, mutate } = useSWR<RFP>(
    `rfp-${id}`,
    () => rfpApi.get(id).then((r) => r.data),
    {
      refreshInterval: (data) =>
        data?.deckStatus === "PENDING" || data?.deckStatus === "GENERATING" ? 3000 : 0,
    }
  );

  const deckStatus = rfp?.deckStatus ?? null;
  const isDecisionReady = rfp
    ? ["DECISION_READY", "ACTION_REQUIRED", "DRAFTING", "IN_REVIEW", "SUBMITTED", "WON"].includes(rfp.status)
    : false;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pptx" && ext !== "docx") {
        setError("يجب أن يكون الملف بصيغة .pptx أو .docx فقط.");
        setTemplateFile(null);
        return;
      }
    }
    setError(null);
    setTemplateFile(file);
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    try {
      await rfpApi.generateDeck(id, templateFile ?? undefined);
      await mutate();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "فشل طلب التوليد. يرجى المحاولة مرة أخرى.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [id, mutate, templateFile]);

  const handleDownload = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    try {
      const response = await rfpApi.downloadDeck(id);
      // Derive filename from Content-Disposition header if available
      const disposition: string = (response.headers as Record<string, string>)["content-disposition"] ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `proposal_${id}.pptx`;

      const blob = new Blob([response.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("فشل تنزيل الملف. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsDownloading(false);
    }
  }, [id]);

  const isInProgress = deckStatus === "PENDING" || deckStatus === "GENERATING";

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary-50 border border-primary-100">
            <FileText className="h-6 w-6 text-primary-600" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-h2 font-semibold text-neutral-900">العرض التقديمي</h2>
            <p className="text-body-sm text-neutral-500 mt-1">
              توليد عرض PowerPoint من قالب مرفوع باستخدام Docling + Claude + PptxGenJS
            </p>
          </div>
          {deckStatus && (
            <span className={cn("text-body-sm font-medium", DECK_STATUS_LABELS[deckStatus].color)}>
              {DECK_STATUS_LABELS[deckStatus].ar}
            </span>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-700">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" aria-hidden />
          <p className="text-body-sm">{error}</p>
        </div>
      )}

      {/* No decision yet */}
      {rfp && !isDecisionReady && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-neutral-200 rounded-lg">
          <AlertCircle className="h-10 w-10 text-warning-500 mb-3" aria-hidden />
          <p className="text-h3 font-semibold text-neutral-700 mb-2">لم يكتمل التحليل بعد</p>
          <p className="text-body-sm text-neutral-500">
            يجب أن تحصل المناقصة على قرار (موافق / مراجعة) قبل توليد العرض التقديمي.
          </p>
        </div>
      )}

      {/* Main action area */}
      {rfp && isDecisionReady && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm space-y-6">

          {/* BD person attribution */}
          {rfp.uploadedByName && (
            <div className="flex items-center gap-2 text-body-sm text-neutral-500 border-b border-neutral-100 pb-4">
              <span className="font-medium text-neutral-700">فحص بواسطة:</span>
              <span>{rfp.uploadedByName}</span>
            </div>
          )}

          {/* Status indicators */}
          {deckStatus === "READY" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success-50 border border-success-200">
              <CheckCircle2 className="h-5 w-5 text-success-500" aria-hidden />
              <div>
                <p className="text-body-sm font-medium text-success-700">تم توليد العرض بنجاح</p>
                <p className="text-caption text-success-500 mt-0.5">
                  ملف PowerPoint (.pptx) جاهز للتنزيل
                </p>
              </div>
            </div>
          )}

          {deckStatus === "FAILED" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-danger-50 border border-danger-200">
              <AlertCircle className="h-5 w-5 text-danger-500" aria-hidden />
              <div>
                <p className="text-body-sm font-medium text-danger-700">فشل التوليد</p>
                <p className="text-caption text-danger-500 mt-0.5">
                  يمكنك المحاولة مرة أخرى مع قالب مختلف أو التواصل مع الدعم.
                </p>
              </div>
            </div>
          )}

          {isInProgress && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-warning-50 border border-warning-200">
              <Loader2 className="h-5 w-5 text-warning-500 animate-spin" aria-hidden />
              <div>
                <p className="text-body-sm font-medium text-warning-700">جارٍ التوليد…</p>
                <p className="text-caption text-warning-500 mt-0.5">
                  المرحلة: Docling → Claude → PptxGenJS. قد يستغرق ذلك دقيقتين إلى ثلاث دقائق.
                </p>
              </div>
            </div>
          )}

          {/* Template upload + pipeline explanation (shown when not generating) */}
          {!isInProgress && (
            <div className="space-y-4">
              <h3 className="text-body-sm font-semibold text-neutral-700">قالب العرض التقديمي</h3>

              {/* File upload drop zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors",
                  templateFile
                    ? "border-primary-400 bg-primary-50"
                    : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileChange(fakeEvent);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pptx,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="h-6 w-6 mx-auto mb-2 text-neutral-400" aria-hidden />
                {templateFile ? (
                  <p className="text-body-sm font-medium text-primary-700">{templateFile.name}</p>
                ) : (
                  <>
                    <p className="text-body-sm text-neutral-600">
                      ارفع قالب <span className="font-semibold">.pptx</span> أو{" "}
                      <span className="font-semibold">.docx</span> لتعلّم نمط التصميم
                    </p>
                    <p className="text-caption text-neutral-400 mt-1">
                      اختياري — يُستخدم القالب المحفوظ في MinIO إذا لم ترفع ملفًا
                    </p>
                  </>
                )}
              </div>

              {/* Pipeline steps */}
              {!deckStatus && (
                <div className="space-y-3 pt-1">
                  <h3 className="text-body-sm font-semibold text-neutral-700">كيف يعمل التوليد؟</h3>
                  <ol className="space-y-2 text-body-sm text-neutral-600 list-decimal list-inside">
                    <li>يُحلَّل القالب المرفوع باستخدام <span className="font-medium">Docling</span> لاستخراج بنية الشرائح والتصميم</li>
                    <li>يُنشئ <span className="font-medium">Claude claude-opus-4-6</span> شرائح جديدة بناءً على بيانات المناقصة</li>
                    <li>يُحوّل <span className="font-medium">PptxGenJS</span> بيانات JSON إلى ملف PowerPoint (.pptx)</li>
                    <li>يُصبح الملف جاهزًا للتنزيل مباشرةً من المنصة</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            {deckStatus !== "READY" && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isInProgress}
                className={cn(
                  "inline-flex items-center gap-2 h-9 px-5 rounded-lg text-body-sm font-semibold transition-colors",
                  "bg-primary-600 text-white hover:bg-primary-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
                )}
              >
                {isGenerating || isInProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                {deckStatus === "FAILED" ? "إعادة التوليد" : "توليد العرض التقديمي"}
              </button>
            )}

            {deckStatus === "READY" && (
              <>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={cn(
                    "inline-flex items-center gap-2 h-9 px-5 rounded-lg text-body-sm font-semibold transition-colors",
                    "bg-success-700 text-white hover:bg-success-900",
                    "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-700 focus-visible:ring-offset-2"
                  )}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                  تنزيل .pptx
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  إعادة التوليد
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Template notice */}
      <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 text-caption text-neutral-500 space-y-1">
        <p className="font-medium text-neutral-600">مصادر القالب (بحسب الأولوية)</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>ملف مرفوع مباشرةً في نموذج التوليد أعلاه</li>
          <li>
            قالب محفوظ في MinIO:{" "}
            <code className="bg-neutral-100 px-1 rounded text-neutral-700">templates/master_proposal.pptx</code>{" "}
            أو{" "}
            <code className="bg-neutral-100 px-1 rounded text-neutral-700">templates/master_proposal.docx</code>
          </li>
          <li>
            متغير البيئة:{" "}
            <code className="bg-neutral-100 px-1 rounded text-neutral-700">DECK_TEMPLATE_PATH</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
