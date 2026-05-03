"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { FileText, Plus, Trophy, BarChart2, Search, ChevronDown, ChevronRight, Tag } from "lucide-react";
import type { Template } from "@/lib/types";

// Using a stub fetcher since we're building the template router separately
const fetchTemplates = async () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const res = await fetch(`${apiBase}/templates`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
};

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR("templates", fetchTemplates, { shouldRetryOnError: false });
  const templates: Template[] = data?.items ?? [];

  const filtered = templates.filter((t) =>
    !search || t.nameAr.toLowerCase().includes(search.toLowerCase()) || t.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-semibold text-neutral-900">القوالب</h1>
            <p className="text-body-sm text-neutral-500 mt-1">قوالب المقترحات حسب نوع المشروع</p>
          </div>
          <button
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden />
            قالب جديد
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
          <input
            type="search"
            placeholder="بحث في القوالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-neutral-200 bg-white ps-9 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            aria-label="البحث في القوالب"
          />
        </div>

        {/* Template list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center shadow-sm">
            <FileText className="h-10 w-10 text-neutral-200 mx-auto mb-3" aria-hidden />
            <p className="text-h3 font-semibold text-neutral-700 mb-1">
              {search ? "لا توجد قوالب تطابق البحث" : "لا توجد قوالب"}
            </p>
            {!search && (
              <p className="text-body-sm text-neutral-400">أضف أول قالب مقترح للمشاريع</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((template) => {
              const isExpanded = expandedTemplate === template.id;
              return (
                <div key={template.id} className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                    className="w-full flex items-center gap-3 p-4 text-start hover:bg-neutral-50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary-600" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-semibold text-neutral-900">{template.nameAr}</p>
                      {template.nameEn && (
                        <p className="text-caption text-neutral-400 dir-ltr">{template.nameEn}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {template.winRate != null && (
                        <div className="flex items-center gap-1 text-success-700">
                          <Trophy className="h-3.5 w-3.5" aria-hidden />
                          <span className="text-caption font-semibold tabular-nums">{Math.round(template.winRate * 100)}%</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-neutral-500">
                        <BarChart2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="text-caption tabular-nums">{template.usedCount ?? 0}</span>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
                        : <ChevronRight className="h-4 w-4 text-neutral-400 rtl:rotate-180" aria-hidden />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-neutral-100 p-4">
                      <div className="flex flex-wrap gap-4 mb-4">
                        <div>
                          <p className="text-caption text-neutral-500 mb-1">اللغات المدعومة</p>
                          <div className="flex gap-1">
                            <span className="text-caption bg-neutral-100 text-neutral-600 rounded px-2 py-0.5">
                              {template.supportedLanguages === "ar" ? "عربي" : template.supportedLanguages === "en" ? "إنجليزي" : "ثنائي"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {template.sections?.length > 0 && (
                        <div>
                          <p className="text-caption text-neutral-500 mb-2">أقسام القالب ({template.sections.length})</p>
                          <ol className="space-y-1">
                            {template.sections.map((section, idx) => (
                              <li key={section.id} className="flex items-center gap-2 text-body-sm text-neutral-700">
                                <span className="text-caption text-neutral-400 tabular-nums w-5 shrink-0">{idx + 1}.</span>
                                <span>{section.titleAr}</span>
                                {section.isRequiredCitations && (
                                  <span className="text-micro text-danger-600">اقتباسات مطلوبة</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <button className="h-8 px-3 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          تعديل
                        </button>
                        <button className="h-8 px-3 rounded-md border border-neutral-200 text-body-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          نسخ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
