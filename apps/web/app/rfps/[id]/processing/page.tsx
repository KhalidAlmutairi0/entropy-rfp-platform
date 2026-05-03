"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { rfpApi } from "@/lib/api";
import { ProgressPipeline, PipelineStep } from "@/components/progress-pipeline";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

// Fix B-F5: Step IDs match backend publish_step() calls in ingestion_tasks.py exactly.
const PIPELINE_STEPS = [
  { id: "file_validation",      label: "التحقق من الملفات" },
  { id: "text_extraction",      label: "استخراج النصوص (OCR)" },
  { id: "ocr",                  label: "دقة التعرف الضوئي" },
  { id: "structure_detection",  label: "اكتشاف الهيكل" },
  { id: "section_classification", label: "تصنيف الأقسام" },
  { id: "scope_detection",      label: "تحليل النطاق" },
  { id: "flag_analysis",        label: "كشف المخاطر والفرص" },
  { id: "capability_matching",  label: "مطابقة القدرات" },
  { id: "decision_scoring",     label: "احتساب درجة التأهيل وإصدار القرار" },
];

export default function ProcessingPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" }))
  );
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fix stale closure: capture done in a ref so onerror always reads current value
  const doneRef = useRef(false);

  const { data: rfp } = useSWR(`rfp-${id}`, () => rfpApi.get(id).then((r) => r.data), {
    refreshInterval: done || failed ? 0 : 3000,
  });

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const es = new EventSource(`${apiBase}/rfps/${id}/status/stream?token=${token}`);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const { step, status, durationMs, message } = event;

        // Fix B-F5: Backend sends step="complete" and step="error", not type="complete"/"failed"
        if (step === "complete") {
          setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
          setDone(true);
          doneRef.current = true;
          es.close();
          setTimeout(() => router.push(`/rfps/${id}/decision`), 1500);
          return;
        }

        if (step === "error") {
          setFailed(true);
          doneRef.current = true;
          setErrorMsg(message ?? "حدث خطأ أثناء المعالجة");
          es.close();
          return;
        }

        if (step) {
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.id === step);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], status, durationMs, message };
            if (status === "done" && idx + 1 < updated.length) {
              updated[idx + 1] = { ...updated[idx + 1], status: "running" };
            }
            return updated;
          });
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // Fix: use ref instead of stale `done` closure
      if (!doneRef.current) {
        setFailed(true);
        doneRef.current = true;
        setErrorMsg("انقطع الاتصال بالخادم");
        es.close();
      }
    };

    return () => es.close();
  }, [id, router]);

  const completedCount = steps.filter((s) => s.status === "done").length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status header */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm text-center">
        {done ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-3" aria-hidden />
            <h2 className="text-h2 font-semibold text-neutral-900 mb-1">اكتملت المعالجة</h2>
            <p className="text-body-sm text-neutral-500">جاري الانتقال إلى صفحة القرار...</p>
          </>
        ) : failed ? (
          <>
            <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto mb-3" aria-hidden />
            <h2 className="text-h2 font-semibold text-neutral-900 mb-1">فشلت المعالجة</h2>
            <p className="text-body-sm text-danger-600 mb-4">{errorMsg}</p>
            <button
              onClick={() => rfpApi.analyze(id).then(() => {
                setFailed(false);
                doneRef.current = false;
                setSteps(PIPELINE_STEPS.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" })));
              })}
              className="h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              إعادة المحاولة
            </button>
          </>
        ) : (
          <>
            <h2 className="text-h2 font-semibold text-neutral-900 mb-1">جاري تحليل المناقصة</h2>
            <p className="text-body-sm text-neutral-500 mb-4">
              يتم تحليل الوثيقة واستخراج البيانات وتقييم الملاءمة
            </p>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="تقدم المعالجة"
              />
            </div>
            <p className="text-caption text-neutral-400 mt-2 tabular-nums">{progress}%</p>
          </>
        )}
      </div>

      {/* Pipeline steps */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-body-sm font-medium text-neutral-600 mb-3">خطوات المعالجة</h3>
        <ProgressPipeline steps={steps} />
      </div>

      {/* File summary */}
      {rfp?.fileCount != null && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
          <p className="text-caption text-neutral-500">
            {rfp.fileCount} ملف · {rfp.totalPages != null ? `${rfp.totalPages} صفحة` : ""}
            {rfp.ocrConfidence != null ? ` · دقة OCR: ${Math.round(rfp.ocrConfidence * 100)}%` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
