"use client";

import { cn, getConfidenceLevel } from "@/lib/utils";

interface ConfidenceMeterProps {
  value: number; // 0–1
  showLabel?: boolean;
  onReviewNeeded?: () => void;
  className?: string;
}

const LABELS = {
  high:   { ar: "عالية",     en: "High",   color: "bg-success-500",  text: "text-success-700" },
  medium: { ar: "متوسطة",    en: "Medium", color: "bg-warning-500",  text: "text-warning-700" },
  low:    { ar: "منخفضة",    en: "Low",    color: "bg-danger-500",   text: "text-danger-700" },
};

export function ConfidenceMeter({ value, showLabel = true, onReviewNeeded, className }: ConfidenceMeterProps) {
  const level = getConfidenceLevel(value);
  const meta = LABELS[level];

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full shrink-0", meta.color)} aria-hidden />
      {showLabel && (
        <span className={cn("text-body-sm font-medium", meta.text)}>
          {meta.ar}
        </span>
      )}
      {level === "low" && onReviewNeeded && (
        <button
          onClick={onReviewNeeded}
          className="text-caption text-primary-600 underline hover:text-primary-700 focus-visible:outline-none"
        >
          مراجعة مطلوبة
        </button>
      )}
    </div>
  );
}
