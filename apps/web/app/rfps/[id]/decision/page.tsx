"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { decisionApi, rfpApi } from "@/lib/api";
import { DecisionBadge } from "@/components/decision-badge";
import { ScoreBar } from "@/components/score-bar";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { EvidenceCard } from "@/components/evidence-card";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Settings2, ArrowRight, CheckCircle2,
  Loader2, SlidersHorizontal, FileText
} from "lucide-react";
import type { Flag } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

export default function DecisionPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const { data: decision, isLoading, mutate } = useSWR(
    `decision-${id}`,
    () => decisionApi.get(id).then((r) => r.data)
  );
  const { data: rfp } = useSWR(`rfp-${id}`, () => rfpApi.get(id).then((r) => r.data));

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState<"GO" | "NO_GO" | "REVIEW">("REVIEW");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  const redFlags: Flag[] = decision?.redFlags ?? [];
  const greenFlags: Flag[] = decision?.greenFlags ?? [];

  const handleOverride = async () => {
    // Fix B-F9: Backend requires reason ≥ 10 chars (Field min_length=10)
    if (overrideReason.trim().length < 10) {
      setOverrideError("يجب أن يحتوي المبرر على 10 أحرف على الأقل");
      return;
    }
    setOverrideLoading(true);
    setOverrideError("");
    try {
      await decisionApi.override(id, overrideDecision, overrideReason);
      await mutate();
      setOverrideOpen(false);
      setOverrideReason("");
    } catch {
      setOverrideError("فشل تحديث القرار، يرجى المحاولة مرة أخرى");
    } finally {
      setOverrideLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center shadow-sm">
        <AlertCircle className="h-10 w-10 text-neutral-300 mx-auto mb-3" aria-hidden />
        <p className="text-h3 font-semibold text-neutral-700 mb-2">القرار غير متاح بعد</p>
        <p className="text-body-sm text-neutral-400 mb-6">
          {rfp?.status === "UPLOADING" || rfp?.status === "ANALYZING"
            ? "المناقصة قيد المعالجة، يرجى الانتظار"
            : "ابدأ تحليل المناقصة للحصول على قرار"}
        </p>
        {rfp?.status === "UPLOADED" && (
          <button
            onClick={() => rfpApi.analyze(id).then(() => router.push(`/rfps/${id}/processing`))}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            بدء التحليل
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Decision summary card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <DecisionBadge decision={decision.decisionType} size="lg" />
              {decision.isOverridden && (
                <span className="text-caption bg-warning-50 text-warning-700 border border-warning-200 rounded-md px-2 py-0.5 font-medium">
                  قرار معدّل يدوياً
                </span>
              )}
            </div>
            <p className="text-body text-neutral-600 max-w-xl leading-relaxed">
              {decision.explanationAr}
            </p>
          </div>

          <div className="text-center bg-neutral-50 rounded-lg p-4 min-w-[100px] border border-neutral-100">
            <p className="text-display font-bold text-neutral-900 tabular-nums">{decision.totalScore}</p>
            <p className="text-caption text-neutral-500 mt-0.5">/ 100</p>
            <p className="text-caption text-neutral-400 mt-1">درجة التأهيل</p>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <ScoreBar
            label="الملاءمة التقنية"
            value={decision.breakdown?.technicalFit ?? 0}
            max={40}
          />
          <ScoreBar
            label="الملاءمة التجارية"
            value={decision.breakdown?.businessFit ?? 0}
            max={30}
          />
          <ScoreBar
            label="خصم المخاطر"
            value={decision.breakdown?.riskPenalty ?? 0}
            max={30}
            variant="risk"
          />
        </div>

        {/* Sub-scores */}
        {decision.breakdown && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-neutral-100">
            {[
              // Fix B-F9: certifications field was wrongly mapped to "تطابق القدرات".
              // Backend schema: capability_match (camelCase: capabilityMatch) is the capability score.
              { label: "تطابق القدرات",  value: decision.breakdown.capabilityMatch },
              { label: "استراتيجية",      value: decision.breakdown.strategicAccount },
              { label: "الخبرة السابقة",  value: decision.breakdown.projectValue },
              { label: "المخاطر",         value: decision.breakdown.complianceRisk },
            ].map((s) => s.value != null && (
              <div key={s.label} className="text-center bg-neutral-50 rounded-md p-2.5 border border-neutral-100">
                <p className="text-h4 font-bold text-neutral-800 tabular-nums">{s.value}</p>
                <p className="text-caption text-neutral-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Confidence + actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100 flex-wrap gap-3">
          <ConfidenceMeter value={decision.confidence} />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeightsOpen(true)}
              className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              ضبط الأوزان
            </button>
            <button
              onClick={() => setOverrideOpen(true)}
              className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              تعديل القرار
            </button>
            {decision.decisionType !== "NO_GO" && (
              <button
                onClick={() => router.push(`/rfps/${id}/proposal`)}
                className="h-8 px-4 flex items-center gap-1.5 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                إعداد المقترح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Red flags */}
        <section aria-labelledby="red-flags-heading">
          <h2 id="red-flags-heading" className="text-h4 font-semibold text-neutral-800 mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-danger-500 inline-block" aria-hidden />
            المخاطر والمعوقات
            {redFlags.length > 0 && (
              <span className="text-caption bg-danger-50 text-danger-700 border border-danger-200 rounded-full px-2 py-0.5 font-medium">
                {redFlags.length}
              </span>
            )}
          </h2>
          {redFlags.length === 0 ? (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-success-500 mx-auto mb-1" aria-hidden />
              <p className="text-body-sm text-success-700">لا توجد مخاطر جوهرية</p>
            </div>
          ) : (
            <div className="space-y-3">
              {redFlags.map((flag) => (
                <EvidenceCard key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </section>

        {/* Green flags */}
        <section aria-labelledby="green-flags-heading">
          <h2 id="green-flags-heading" className="text-h4 font-semibold text-neutral-800 mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success-500 inline-block" aria-hidden />
            نقاط القوة والفرص
            {greenFlags.length > 0 && (
              <span className="text-caption bg-success-50 text-success-700 border border-success-200 rounded-full px-2 py-0.5 font-medium">
                {greenFlags.length}
              </span>
            )}
          </h2>
          {greenFlags.length === 0 ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
              <p className="text-body-sm text-neutral-500">لم يتم رصد نقاط قوة بارزة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {greenFlags.map((flag) => (
                <EvidenceCard key={flag.id} flag={flag} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Override modal */}
      {overrideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="override-title">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 id="override-title" className="text-h3 font-semibold text-neutral-900">تعديل القرار</h3>
            <p className="text-body-sm text-neutral-500">سيُسجَّل التعديل في سجل المراجعة مع تاريخه ومبرره.</p>

            <div>
              <label className="block text-body-sm font-medium text-neutral-700 mb-1">القرار الجديد</label>
              <div className="flex gap-2">
                {(["GO", "REVIEW", "NO_GO"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setOverrideDecision(d)}
                    className={cn(
                      "flex-1 h-9 rounded-md border text-body-sm font-medium transition-colors",
                      overrideDecision === d
                        ? d === "GO" ? "bg-success-600 text-white border-success-600"
                          : d === "NO_GO" ? "bg-danger-600 text-white border-danger-600"
                          : "bg-warning-600 text-white border-warning-600"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    )}
                  >
                    {d === "GO" ? "موافقة" : d === "NO_GO" ? "رفض" : "مراجعة"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="override-reason" className="block text-body-sm font-medium text-neutral-700 mb-1">
                المبرر <span className="text-danger-500">*</span>
              </label>
              <textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="اذكر سبب تعديل القرار..."
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
              />
              {overrideError && (
                <p className="text-caption text-danger-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {overrideError}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setOverrideOpen(false); setOverrideReason(""); setOverrideError(""); }}
                className="h-9 px-4 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleOverride}
                disabled={overrideLoading}
                className="h-9 px-4 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {overrideLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                تأكيد التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weights modal */}
      {weightsOpen && (
        <WeightsModal rfpId={id} onClose={() => setWeightsOpen(false)} onSave={() => { mutate(); setWeightsOpen(false); }} />
      )}
    </div>
  );
}

function WeightsModal({ rfpId, onClose, onSave }: { rfpId: string; onClose: () => void; onSave: () => void }) {
  // Fix B-F9: Backend WeightAdjustRequest expects floats 0.0–3.0, not 0–100 integers.
  // Default 1.0 = neutral multiplier. 0 = ignore that dimension, 3.0 = triple weight.
  const [weights, setWeights] = useState({ technical: 1.0, business: 1.0, risk: 1.0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      await decisionApi.adjustWeights(rfpId, {
        technical_weight: weights.technical,
        business_weight: weights.business,
        risk_weight: weights.risk,
      });
      onSave();
    } catch {
      setError("فشل حفظ الأوزان");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="weights-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 id="weights-title" className="text-h3 font-semibold text-neutral-900">ضبط أوزان التقييم</h3>
        <p className="text-caption text-neutral-500">1.0 = وزن افتراضي · 0.0 = تجاهل · 3.0 = تضخيم</p>

        {(["technical", "business", "risk"] as const).map((key) => {
          const labels = { technical: "الملاءمة التقنية", business: "الملاءمة التجارية", risk: "خصم المخاطر" };
          return (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-body-sm font-medium text-neutral-700">{labels[key]}</label>
                <span className="text-body-sm text-neutral-500 tabular-nums">{weights[key].toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: parseFloat(e.target.value) }))}
                className="w-full accent-primary-600"
              />
            </div>
          );
        })}

        {error && <p className="text-caption text-danger-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors">إلغاء</button>
          <button onClick={handleSave} disabled={loading} className="h-9 px-4 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
