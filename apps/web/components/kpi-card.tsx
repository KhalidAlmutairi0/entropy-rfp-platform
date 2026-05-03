"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  delta?: number; // positive = up, negative = down, 0 = neutral
  deltaLabel?: string;
  className?: string;
}

export function KPICard({ label, value, subtitle, delta, deltaLabel, className }: KPICardProps) {
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;

  return (
    <div className={cn("bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm", className)}>
      <p className="text-body-sm text-neutral-500 mb-1">{label}</p>
      <p className="text-display font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{value}</p>
      {subtitle && <p className="text-caption text-neutral-400 mt-0.5">{subtitle}</p>}
      {delta != null && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-body-sm font-medium",
            isUp && "text-success-700",
            isDown && "text-danger-700",
            !isUp && !isDown && "text-neutral-500"
          )}
        >
          {isUp && <TrendingUp className="h-3.5 w-3.5" aria-hidden />}
          {isDown && <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
          {!isUp && !isDown && <Minus className="h-3.5 w-3.5" aria-hidden />}
          <span>{deltaLabel ?? (isUp ? `+${delta}%` : `${delta}%`)}</span>
        </div>
      )}
    </div>
  );
}
