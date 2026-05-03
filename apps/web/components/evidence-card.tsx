"use client";

import { AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flag } from "@/lib/types";

interface EvidenceCardProps {
  flag: Flag;
  onViewInRFP?: (page: number) => void;
  lang?: "ar" | "en";
  className?: string;
}

const SEVERITY_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  CRITICAL: { ar: "حرجة",  en: "Critical", color: "bg-danger-500 text-white" },
  MAJOR:    { ar: "رئيسية",en: "Major",    color: "bg-warning-500 text-white" },
  MINOR:    { ar: "ثانوية",en: "Minor",    color: "bg-neutral-500 text-white" },
};

export function EvidenceCard({ flag, onViewInRFP, lang = "ar", className }: EvidenceCardProps) {
  const isRed = flag.flagType === "RED";
  const title = lang === "ar" ? flag.titleAr : flag.titleEn;
  const description = lang === "ar" ? flag.descriptionAr : flag.descriptionEn;
  const severityMeta = flag.severity ? SEVERITY_LABELS[flag.severity] : null;

  return (
    <div
      className={cn(
        "rounded-md p-3 border border-s-[3px]",
        isRed
          ? "bg-danger-50 border-danger-100 border-s-danger-500"
          : "bg-success-50 border-success-100 border-s-success-500",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {isRed ? (
          <AlertTriangle className="h-4 w-4 text-danger-500 mt-0.5 shrink-0" aria-hidden />
        ) : (
          <CheckCircle className="h-4 w-4 text-success-500 mt-0.5 shrink-0" aria-hidden />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {title && (
              <span className={cn("text-body-sm font-semibold", isRed ? "text-danger-700" : "text-success-700")}>
                {title}
              </span>
            )}
            {severityMeta && (
              <span className={cn("text-micro rounded px-1.5 py-0.5 font-medium", severityMeta.color)}>
                {severityMeta[lang]}
              </span>
            )}
            {flag.isManual && (
              <span className="text-micro bg-neutral-200 text-neutral-600 rounded px-1.5 py-0.5">يدوي</span>
            )}
          </div>

          {description && (
            <p className="text-body-sm text-neutral-600 mb-2">{description}</p>
          )}

          {flag.evidenceQuote && (
            <blockquote className={cn(
              "text-body-sm italic border-s-2 ps-2 my-1",
              isRed ? "border-danger-300 text-danger-800" : "border-success-300 text-success-800"
            )}>
              "{flag.evidenceQuote}"
            </blockquote>
          )}

          <div className="flex items-center gap-3 mt-2">
            {flag.pageNumber && (
              <span className="text-caption text-neutral-500">صفحة {flag.pageNumber}</span>
            )}
            {flag.sectionName && (
              <span className="text-caption text-neutral-400">{flag.sectionName}</span>
            )}
            {flag.pageNumber && onViewInRFP && (
              <button
                onClick={() => onViewInRFP(flag.pageNumber!)}
                className="text-caption text-primary-600 hover:text-primary-700 flex items-center gap-0.5 underline"
              >
                عرض في الوثيقة
                <ExternalLink className="h-3 w-3" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
