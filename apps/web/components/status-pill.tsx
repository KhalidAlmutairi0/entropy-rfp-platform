"use client";

import { cn, getStatusColors, STATUS_LABELS } from "@/lib/utils";
import type { RFPStatus } from "@/lib/types";

interface StatusPillProps {
  status: RFPStatus;
  lang?: "ar" | "en";
  className?: string;
}

export function StatusPill({ status, lang = "ar", className }: StatusPillProps) {
  const colors = getStatusColors(status);
  const label = STATUS_LABELS[status]?.[lang] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium",
        "h-[22px]",
        colors.bg,
        colors.text,
        className
      )}
      role="status"
      aria-label={`Status: ${label}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colors.dot)} aria-hidden />
      {label}
    </span>
  );
}
