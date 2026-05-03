"use client";

import { CheckCircle, Loader2, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "running" | "pending" | "warning" | "failed";

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  message?: string;
}

interface ProgressPipelineProps {
  steps: PipelineStep[];
  className?: string;
}

const StatusIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case "done":
      return <CheckCircle className="h-5 w-5 text-success-500 shrink-0" aria-label="مكتمل" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-primary-600 animate-spin shrink-0" aria-label="جاري التنفيذ" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-warning-500 shrink-0" aria-label="تحذير" />;
    case "failed":
      return <AlertTriangle className="h-5 w-5 text-danger-500 shrink-0" aria-label="فشل" />;
    default:
      return <Circle className="h-5 w-5 text-neutral-300 shrink-0" aria-label="في الانتظار" />;
  }
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export function ProgressPipeline({ steps, className }: ProgressPipelineProps) {
  return (
    <ol className={cn("space-y-1", className)} aria-label="مراحل المعالجة">
      {steps.map((step) => (
        <li
          key={step.id}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-body-sm transition-colors",
            step.status === "running" && "bg-primary-50",
            step.status === "done" && "text-neutral-500",
            step.status === "pending" && "text-neutral-400",
            step.status === "warning" && "bg-warning-50",
            step.status === "failed" && "bg-danger-50 text-danger-700",
          )}
        >
          <StatusIcon status={step.status} />
          <span className="flex-1">{step.label}</span>
          <span className="text-caption text-neutral-400 tabular-nums shrink-0">
            {step.status === "running" && "جاري..."}
            {step.status === "pending" && "في الانتظار"}
            {step.status === "done" && step.durationMs != null && formatDuration(step.durationMs)}
            {step.status === "warning" && step.message}
            {step.status === "failed" && step.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
