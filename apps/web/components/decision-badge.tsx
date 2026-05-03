"use client";

import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn, getDecisionColors, DECISION_LABELS } from "@/lib/utils";
import type { DecisionType } from "@/lib/types";

interface DecisionBadgeProps {
  decision: DecisionType;
  score?: number;
  size?: "sm" | "md" | "lg";
  lang?: "ar" | "en";
  className?: string;
}

const icons: Record<DecisionType, React.ElementType> = {
  GO:     CheckCircle,
  NO_GO:  XCircle,
  REVIEW: AlertTriangle,
};

export function DecisionBadge({ decision, score, size = "md", lang = "ar", className }: DecisionBadgeProps) {
  const colors = getDecisionColors(decision);
  const Icon = icons[decision];
  const label = DECISION_LABELS[decision][lang];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold tabular-nums",
        colors.bg,
        colors.border,
        colors.text,
        size === "sm" && "text-micro px-2 py-0.5 h-[22px]",
        size === "md" && "text-body-sm px-3 py-0 h-[36px]",
        size === "lg" && "text-body px-4 py-1 h-[44px]",
        className
      )}
      role="status"
      aria-label={`Decision: ${label}`}
    >
      <Icon className={cn("shrink-0", colors.icon, size === "sm" ? "h-3 w-3" : "h-4 w-4")} aria-hidden />
      <span>{label}</span>
      {score != null && (
        <span className="ms-1 opacity-75">· {score}</span>
      )}
    </span>
  );
}
