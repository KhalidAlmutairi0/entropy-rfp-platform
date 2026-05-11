"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";
import { proposalApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Lock, Unlock, RefreshCw, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle2, Loader2, Languages, Eye, EyeOff
} from "lucide-react";
import type { ProposalSection } from "@/lib/types";

interface Props { params: { id: string } }

export default function ProposalPage({ params }: Props) {
  const { id } = params;
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [previewMode, setPreviewMode] = useState(false);
  // Fix S-F4: per-section instructions — keyed by section ID so typing for section A
  // doesn't bleed into section B's regeneration call
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>({});
  const [streamingSection, setStreamingSection] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: proposal, isLoading, mutate } = useSWR(
    `proposal-${id}`,
    () => proposalApi.get(id).then((r) => r.data)
  );

  const sections: ProposalSection[] = proposal?.sections ?? [];
  const activeSectionData = sections.find((s) => s.id === activeSection);

  const handleCreateProposal = async () => {
    setCreating(true);
    setCreateError("");
    try {
      await proposalApi.create(id);
      let generated = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await proposalApi.get(id);
        const sections = result.data?.sections ?? [];
        const aiSections = sections.filter((s: ProposalSection) => !s.isLocked);
        const isReady = aiSections.length > 0 && aiSections.every((s: ProposalSection) => !!s.contentAr?.trim());
        if (isReady) {
          await mutate(result.data, false);
          generated = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      if (!generated) {
        await mutate();
      }
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail ?? "Failed to generate proposal");
    } finally {
      setCreating(false);
    }
  };

  const handleSectionSave = async (sectionId: string, content: string) => {
    await proposalApi.updateSection(id, sectionId, { contentAr: lang === "ar" ? content : undefined, contentEn: lang === "en" ? content : undefined });
    await mutate();
  };

  const handleRegenerate = async (sectionId: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setStreamingSection(sectionId);
    setStreamingContent("");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
      const resp = await fetch(
        `${apiBase}/rfps/${id}/proposal/sections/${sectionId}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          // Fix S-F4: use per-section instructions keyed by sectionId
          body: JSON.stringify({ instructions: sectionInstructions[sectionId] ?? "", language: lang }),
          signal: abortRef.current.signal,
        }
      );

      if (!resp.ok) throw new Error("Failed");
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        // Fix B-F10: Backend sends SSE format: `data: {"chunk":"text"}\n\n` + `data: [DONE]\n\n`
        // Strip the "data: " prefix and JSON-decode each line to extract the text chunk.
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.chunk === "string") accumulated += parsed.chunk;
          } catch { /* ignore malformed lines */ }
        }
        setStreamingContent(accumulated);
      }
      await mutate();
    } catch (err: any) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setStreamingSection(null);
      setStreamingContent("");
      // Clear only this section's instructions after generation
      setSectionInstructions((prev) => {
        const next = { ...prev };
        delete next[streamingSection ?? sectionId];
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
        <div className="w-64 skeleton rounded-lg" />
        <div className="flex-1 skeleton rounded-lg" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center shadow-sm space-y-4">
        <p className="text-h3 font-semibold text-neutral-700 mb-2">لا يوجد مقترح بعد</p>
        <p className="text-body-sm text-neutral-400">
          أنشئ مقترحاً مبنياً على تحليل وثيقة المناقصة
        </p>
        {createError && (
          <div className="flex items-center justify-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-md px-4 py-2 text-body-sm max-w-sm mx-auto">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {createError}
          </div>
        )}
        <button
          onClick={handleCreateProposal}
          disabled={creating}
          className="h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {creating ? "جاري الإنشاء..." : "إنشاء مقترح"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
      {/* Section list */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-body-sm font-medium text-neutral-700">الأقسام</span>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 transition-colors"
            aria-label={`التبديل إلى ${lang === "ar" ? "الإنجليزية" : "العربية"}`}
          >
            <Languages className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <ol className="flex-1 overflow-y-auto divide-y divide-neutral-50">
          {sections.map((section, idx) => {
            const isActive = section.id === activeSection;
            const content = lang === "ar" ? section.contentAr : section.contentEn;
            const hasContent = !!content?.trim();
            return (
              <li key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full text-start px-3 py-2.5 flex items-center gap-2 transition-colors",
                    isActive ? "bg-primary-50" : "hover:bg-neutral-50"
                  )}
                >
                  <span className="text-caption text-neutral-400 tabular-nums w-4 shrink-0">{idx + 1}</span>
                  <span className={cn("text-body-sm flex-1 leading-snug", isActive ? "text-primary-700 font-medium" : "text-neutral-700")}>
                    {lang === "ar" ? section.titleAr : section.titleEn}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {section.isLocked && <Lock className="h-3 w-3 text-neutral-400" aria-label="مقفل" />}
                    {section.hasUngroundedClaims && <AlertCircle className="h-3 w-3 text-warning-500" aria-label="ادعاءات غير موثقة" />}
                    {hasContent && !section.hasUngroundedClaims && <CheckCircle2 className="h-3 w-3 text-success-400" aria-label="مكتمل" />}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Export CTA */}
        <div className="p-3 border-t border-neutral-100">
          <a
            href={`/rfps/${id}/export`}
            className="w-full h-8 flex items-center justify-center rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            تصدير المقترح
          </a>
        </div>
      </aside>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        {activeSectionData ? (
          <>
            {/* Section toolbar */}
            <div className="h-10 border-b border-neutral-100 flex items-center gap-2 px-3 shrink-0">
              <span className="text-body-sm font-medium text-neutral-700 flex-1">
                {lang === "ar" ? activeSectionData.titleAr : activeSectionData.titleEn}
              </span>

              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="h-7 px-2 flex items-center gap-1.5 rounded text-caption text-neutral-500 hover:bg-neutral-100 transition-colors"
                aria-label={previewMode ? "تحرير" : "معاينة"}
              >
                {previewMode ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                {previewMode ? "تحرير" : "معاينة"}
              </button>

              {!activeSectionData.isLocked && (
                <button
                  onClick={() => handleRegenerate(activeSectionData.id)}
                  disabled={streamingSection === activeSectionData.id}
                  className="h-7 px-2 flex items-center gap-1.5 rounded text-caption text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  {streamingSection === activeSectionData.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    : <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  }
                  إعادة توليد
                </button>
              )}

              {activeSectionData.isLocked && (
                <span className="h-7 px-2 flex items-center gap-1.5 text-caption text-neutral-400">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  مقفل
                </span>
              )}
            </div>

            {/* Editor / Preview */}
            <div className="flex-1 overflow-auto">
              {previewMode ? (
                <div
                  className="p-6 prose prose-sm max-w-none"
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  // Fix B-F7: Sanitize AI-generated HTML before rendering to prevent stored XSS.
                  // Uses a DOM-based sanitizer — strips scripts, event handlers, and dangerous tags.
                  dangerouslySetInnerHTML={{
                    __html: _sanitizeHtml(
                      (lang === "ar" ? activeSectionData.contentAr : activeSectionData.contentEn) ?? "<p class='text-neutral-400'>لا يوجد محتوى</p>"
                    )
                  }}
                />
              ) : streamingSection === activeSectionData.id ? (
                <div className="p-6">
                  <p className="text-body-sm text-neutral-500 mb-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden />
                    جاري توليد المحتوى...
                  </p>
                  <div className="text-body whitespace-pre-wrap text-neutral-800 streaming-chunk" dir={lang === "ar" ? "rtl" : "ltr"}>
                    {streamingContent}
                  </div>
                </div>
              ) : (
                <SectionEditor
                  key={activeSectionData.id}
                  section={activeSectionData}
                  lang={lang}
                  onSave={handleSectionSave}
                />
              )}
            </div>

            {/* Regenerate instructions — Fix S-F4: per-section, keyed by section ID */}
            {!activeSectionData.isLocked && (
              <div className="border-t border-neutral-100 p-3 bg-neutral-50 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="تعليمات إعادة التوليد (اختياري)..."
                    value={sectionInstructions[activeSectionData.id] ?? ""}
                    onChange={(e) => setSectionInstructions((prev) => ({ ...prev, [activeSectionData.id]: e.target.value }))}
                    className="flex-1 h-8 rounded-md border border-neutral-200 bg-white px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                    onKeyDown={(e) => e.key === "Enter" && handleRegenerate(activeSectionData.id)}
                  />
                  <button
                    onClick={() => handleRegenerate(activeSectionData.id)}
                    disabled={streamingSection === activeSectionData.id}
                    className="h-8 px-3 rounded-md bg-primary-600 text-white text-body-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {streamingSection === activeSectionData.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      : <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    }
                    توليد
                  </button>
                </div>
              </div>
            )}

            {/* Citations / confidence */}
            {activeSectionData.confidence != null && (
              <div className="border-t border-neutral-100 px-3 py-2 flex items-center gap-3 bg-white shrink-0">
                <span className="text-caption text-neutral-500">
                  الثقة: {Math.round(activeSectionData.confidence * 100)}%
                </span>
                {activeSectionData.hasUngroundedClaims && (
                  <span className="text-caption text-warning-700 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                    تحتوي على ادعاءات غير موثقة — مراجعة مطلوبة قبل التصدير
                  </span>
                )}
                {activeSectionData.isAiGenerated && (
                  <span className="text-caption text-neutral-400">مولّد بالذكاء الاصطناعي</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <p className="text-h3 font-semibold text-neutral-600 mb-2">اختر قسماً</p>
              <p className="text-body-sm text-neutral-400">اختر قسماً من القائمة لبدء التحرير</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fix B-F7: DOM-based HTML sanitizer for AI-generated content.
 * Removes <script>, inline event handlers (on*), and other dangerous tags
 * without requiring an external library.
 */
function _sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  const DANGEROUS = ["script", "iframe", "object", "embed", "link", "meta", "base", "form", "input", "button"];
  div.querySelectorAll(DANGEROUS.join(",")).forEach((el) => el.remove());
  div.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (/^on/i.test(attr.name) || (attr.name === "href" && /^javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return div.innerHTML;
}

function SectionEditor({
  section,
  lang,
  onSave,
}: {
  section: ProposalSection;
  lang: "ar" | "en";
  onSave: (id: string, content: string) => Promise<void>;
}) {
  const content = lang === "ar" ? section.contentAr : section.contentEn;
  const [value, setValue] = useState(content ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(section.id, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={section.isLocked}
        dir={lang === "ar" ? "rtl" : "ltr"}
        className={cn(
          "flex-1 w-full resize-none p-6 text-body text-neutral-800 focus:outline-none leading-relaxed font-[var(--font-arabic)]",
          section.isLocked && "bg-neutral-50 text-neutral-600 cursor-not-allowed"
        )}
        placeholder={section.isLocked ? "هذا القسم مقفل" : "اكتب محتوى القسم هنا..."}
        aria-label={(lang === "ar" ? section.titleAr : section.titleEn) ?? undefined}
      />
      {!section.isLocked && (
        <div className="border-t border-neutral-100 px-3 py-2 flex items-center justify-end gap-2 bg-white shrink-0">
          {saved && (
            <span className="text-caption text-success-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              تم الحفظ
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            حفظ
          </button>
        </div>
      )}
    </div>
  );
}
