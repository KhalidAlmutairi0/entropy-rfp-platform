import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RFPStatus, DecisionType } from "./types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined, locale = "ar-SA"): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ar-SA");
}

export function formatSAR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
}

export function truncate(text: string, maxLength = 60): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

export function getStatusColors(status: RFPStatus): { bg: string; text: string; dot: string } {
  const map: Record<RFPStatus, { bg: string; text: string; dot: string }> = {
    UPLOADED:       { bg: "bg-neutral-100",  text: "text-neutral-600", dot: "bg-neutral-400" },
    ANALYZING:      { bg: "bg-info-50",      text: "text-info-700",    dot: "bg-info-500" },
    DECISION_READY: { bg: "bg-primary-50",   text: "text-primary-700", dot: "bg-primary-600" },
    ACTION_REQUIRED:{ bg: "bg-warning-50",   text: "text-warning-700", dot: "bg-warning-500" },
    DRAFTING:       { bg: "bg-primary-50",   text: "text-primary-700", dot: "bg-primary-600" },
    IN_REVIEW:      { bg: "bg-info-50",      text: "text-info-700",    dot: "bg-info-500" },
    SUBMITTED:      { bg: "bg-neutral-100",  text: "text-neutral-700", dot: "bg-neutral-500" },
    WON:            { bg: "bg-success-50",   text: "text-success-700", dot: "bg-success-500" },
    LOST:           { bg: "bg-danger-50",    text: "text-danger-700",  dot: "bg-danger-500" },
    ARCHIVED:       { bg: "bg-neutral-50",   text: "text-neutral-500", dot: "bg-neutral-300" },
  };
  return map[status] ?? { bg: "bg-neutral-100", text: "text-neutral-600", dot: "bg-neutral-400" };
}

export function getDecisionColors(decision: DecisionType): { bg: string; border: string; text: string; icon: string } {
  const map: Record<DecisionType, { bg: string; border: string; text: string; icon: string }> = {
    GO:     { bg: "bg-success-50", border: "border-success-500", text: "text-success-700", icon: "text-success-500" },
    NO_GO:  { bg: "bg-danger-50",  border: "border-danger-500",  text: "text-danger-700",  icon: "text-danger-500" },
    REVIEW: { bg: "bg-warning-50", border: "border-warning-500", text: "text-warning-700", icon: "text-warning-500" },
  };
  return map[decision];
}

export function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

export function fileSizeHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const STATUS_LABELS: Record<RFPStatus, { ar: string; en: string }> = {
  UPLOADED:        { ar: "تم الرفع",       en: "Uploaded" },
  ANALYZING:       { ar: "جاري التحليل",   en: "Analyzing" },
  DECISION_READY:  { ar: "قرار جاهز",      en: "Decision Ready" },
  ACTION_REQUIRED: { ar: "إجراء مطلوب",    en: "Action Required" },
  DRAFTING:        { ar: "جاري الصياغة",   en: "Drafting" },
  IN_REVIEW:       { ar: "قيد المراجعة",   en: "In Review" },
  SUBMITTED:       { ar: "مقدم",           en: "Submitted" },
  WON:             { ar: "فاز",            en: "Won" },
  LOST:            { ar: "خسر",            en: "Lost" },
  ARCHIVED:        { ar: "مؤرشف",          en: "Archived" },
};

export const DECISION_LABELS: Record<DecisionType, { ar: string; en: string }> = {
  GO:     { ar: "المضي قدماً", en: "GO" },
  NO_GO:  { ar: "لا تقدم",    en: "NO-GO" },
  REVIEW: { ar: "مراجعة",     en: "REVIEW" },
};
