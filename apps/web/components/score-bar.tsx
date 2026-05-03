"use client";

import { cn } from "@/lib/utils";

interface ScoreBarProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  variant?: "default" | "risk";
  className?: string;
}

export function ScoreBar({ value, max, label, sublabel, variant = "default", className }: ScoreBarProps) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / max) * 100));
  const isRisk = variant === "risk";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-body-sm text-neutral-600 truncate">{label}</span>
          {sublabel && <span className="text-caption text-neutral-400 ms-2">{sublabel}</span>}
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isRisk ? "bg-danger-500" : "bg-primary-600"
            )}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemax={max}
            aria-valuemin={0}
          />
        </div>
      </div>
      <span
        className={cn(
          "text-body-sm font-semibold tabular-nums w-14 text-end shrink-0",
          isRisk ? "text-danger-700" : "text-primary-700"
        )}
      >
        {isRisk ? "−" : ""}{value}/{max}
      </span>
    </div>
  );
}
