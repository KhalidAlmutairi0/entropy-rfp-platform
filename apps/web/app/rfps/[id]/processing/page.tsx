"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { rfpApi } from "@/lib/api";
import { ProgressPipeline, PipelineStep } from "@/components/progress-pipeline";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props { params: { id: string } }

// Fix B-F5: Step IDs match backend publish_step() calls in ingestion_tasks.py exactly.
const PIPELINE_STEPS = [
  { id: "file_validation",        label: "التحقق من الملفات" },
  { id: "text_extraction",        label: "استخراج النصوص (OCR)" },
  { id: "ocr",                    label: "دقة التعرف الضوئي" },
  { id: "structure_detection",    label: "اكتشاف الهيكل" },
  { id: "section_classification", label: "تصنيف الأقسام" },
  { id: "scope_detection",        label: "تحليل النطاق" },
  { id: "flag_analysis",          label: "كشف المخاطر والفرص" },
  { id: "capability_matching",    label: "مطابقة القدرات" },
  { id: "decision_scoring",       label: "احتساب درجة التأهيل وإصدار القرار" },
];

// Seconds between fake step advances when in polling mode (no SSE).
// 9 steps × 6s ≈ 54s covers typical analysis time; last step stays "running" until status arrives.
const POLLING_STEP_INTERVAL_MS = 6000;

export default function ProcessingPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();

  const [steps, setSteps] = useState<PipelineStep[]>(
    PIPELINE_STEPS.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" }))
  );
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // When true, SSE is unavailable — we fall back to useSWR polling for completion.
  const [pollingMode, setPollingMode] = useState(false);

  // Refs to avoid stale closures in event handlers.
  const doneRef = useRef(false);
  const pollingModeRef = useRef(false);

  // Poll RFP status every 3s; pause when done or failed.
  const { data: rfp } = useSWR(
    `rfp-${id}`,
    () => rfpApi.get(id).then((r) => r.data),
    { refreshInterval: done || failed ? 0 : 3000 }
  );

  // Watch rfp.status in polling mode to detect completion or failure.
  useEffect(() => {
    if (!pollingMode || doneRef.current) return;
    if (!rfp) return;

    if (rfp.status === "DECISION_READY") {
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      setDone(true);
      doneRef.current = true;
      setTimeout(() => router.push(`/rfps/${id}/decision`), 1500);
    } else if (rfp.status === "ACTION_REQUIRED") {
      setFailed(true);
      doneRef.current = true;
      setErrorMsg("فشل التحليل — يرجى المراجعة اليدوية");
    }
  }, [rfp, pollingMode, id, router]);

  // In polling mode, advance steps on a timer to show fake progress (cosmetic).
  useEffect(() => {
    if (!pollingMode || done || failed) return;

    const interval = setInterval(() => {
      if (doneRef.current) {
        clearInterval(interval);
        return;
      }
      setSteps((prev) => {
        const runningIdx = prev.findIndex((s) => s.status === "running");
        // Keep last step "running" until polling detects completion.
        if (runningIdx === -1 || runningIdx === prev.length - 1) return prev;
        const updated = [...prev];
        updated[runningIdx] = { ...updated[runningIdx], status: "done" };
        updated[runningIdx + 1] = { ...updated[runningIdx + 1], status: "running" };
        return updated;
      });
    }, POLLING_STEP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pollingMode, done, failed]);

  // SSE for real-time step updates.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const es = new EventSource(`${apiBase}/rfps/${id}/status/stream?token=${token}`);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const { step, status, durationMs, message } = event;

        if (step === "complete") {
          setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
          setDone(true);
          doneRef.current = true;
          es.close();
          setTimeout(() => router.push(`/rfps/${id}/decision`), 1500);
          return;
        }

        // Backend signals Redis unavailable — fall back to polling, don't show failure.
        if (step === "error" && status === "unavailable") {
          es.close();
          if (!doneRef.current) {
            pollingModeRef.current = true;
            setPollingMode(true);
          }
          return;
        }

        // Any other error from the pipeline.
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
      // Stream closed (Redis unavailable or transient disconnect) — switch to polling.
      if (!doneRef.current) {
        es.close();
        pollingModeRef.current = true;
        setPollingMode(true);
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
                setPollingMode(false);
                pollingModeRef.current = false;
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
                style={{ width: `${Math.max(progress, pollingMode ? 5 : 0)}%` }}
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
