"use client";

import { useState } from "react";
import useSWR from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { knowledgeApi } from "@/lib/api";
import { cn, formatDate, fileSizeHuman } from "@/lib/utils";
import {
  BookOpen, Upload, Search, RefreshCw, Tag, CheckCircle2,
  Loader2, AlertCircle, BarChart2, Clock, Database, File
} from "lucide-react";
import type { KnowledgeDoc } from "@/lib/types";

const DOC_TYPE_LABELS: Record<string, string> = {
  PAST_PROPOSAL:    "مقترح سابق",
  COMPANY_PROFILE:  "ملف الشركة",
  CAPABILITY:       "قدرات تقنية",
  PRICING_TEMPLATE: "قالب تسعير",
  COMPLIANCE_DOC:   "وثيقة امتثال",
  REFERENCE:        "مرجع",
  OTHER:            "أخرى",
};

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    ["knowledge", search, docType],
    () => knowledgeApi.list({ search: search || undefined, docType: docType || undefined }).then((r) => r.data)
  );

  const { data: stats } = useSWR("knowledge-stats", () => knowledgeApi.stats().then((r) => r.data));

  const docs: KnowledgeDoc[] = data?.items ?? [];

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess(false);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", "OTHER");
        await knowledgeApi.upload(formData);
      }
      await mutate();
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string" && detail.includes("duplicate")) {
        setUploadError("الملف موجود بالفعل في قاعدة المعرفة");
      } else {
        setUploadError("فشل الرفع، يرجى المحاولة مرة أخرى");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-semibold text-neutral-900">قاعدة المعرفة</h1>
            <p className="text-body-sm text-neutral-500 mt-1">المستندات المرجعية لتحسين التحليل وتوليد المقترحات</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "إجمالي الوثائق",     value: stats.totalDocs,     icon: Database,   color: "text-primary-700" },
              { label: "مفهرسة",             value: stats.indexedDocs,   icon: CheckCircle2, color: "text-success-700" },
              { label: "إجمالي الأجزاء",     value: stats.totalChunks,   icon: BarChart2,  color: "text-neutral-700" },
              { label: "آخر تحديث",          value: stats.lastIndexedAt ? formatDate(stats.lastIndexedAt) : "—", icon: Clock, color: "text-neutral-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm flex items-center gap-3">
                <s.icon className={cn("h-5 w-5 shrink-0", s.color)} aria-hidden />
                <div className="min-w-0">
                  <p className={cn("text-h4 font-bold tabular-nums", s.color)}>{s.value}</p>
                  <p className="text-caption text-neutral-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload zone */}
        <div
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); }}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            dragActive ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50"
          )}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-primary-700">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-body-sm font-medium">جاري الرفع...</span>
            </div>
          ) : uploadSuccess ? (
            <div className="flex items-center justify-center gap-2 text-success-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              <span className="text-body-sm font-medium">تم الرفع بنجاح</span>
            </div>
          ) : (
            <>
              <Upload className="h-7 w-7 text-neutral-300 mx-auto mb-2" aria-hidden />
              <p className="text-body-sm font-medium text-neutral-600">اسحب الملفات وأسقطها هنا</p>
              <p className="text-caption text-neutral-400 mt-1">أو</p>
              <label className="mt-2 inline-block cursor-pointer">
                <span className="h-8 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary-600 text-white text-body-sm font-semibold hover:bg-primary-700 transition-colors">
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  اختر ملفات
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.zip"
                  className="sr-only"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
              <p className="text-caption text-neutral-400 mt-2">PDF، DOCX · الحد الأقصى 100 ميغابايت</p>
            </>
          )}
          {uploadError && (
            <p className="mt-2 text-caption text-danger-700 flex items-center justify-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {uploadError}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden />
            <input
              type="search"
              placeholder="بحث في قاعدة المعرفة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-md border border-neutral-200 bg-white ps-9 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              aria-label="البحث في قاعدة المعرفة"
            />
          </div>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            aria-label="فلتر نوع الوثيقة"
          >
            <option value="">كل الأنواع</option>
            {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => mutate()}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors"
            aria-label="تحديث"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Document list */}
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-md" />)}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-neutral-200 mb-3" aria-hidden />
              <p className="text-h3 font-semibold text-neutral-700 mb-1">قاعدة المعرفة فارغة</p>
              <p className="text-body-sm text-neutral-400">
                {search || docType ? "لا تتطابق نتائج مع الفلاتر" : "ارفع أول وثيقة مرجعية"}
              </p>
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {["الوثيقة", "النوع", "اللغة", "الحالة", "الاستخدامات", "تاريخ الفهرسة"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-medium text-neutral-500 text-caption">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-neutral-400 shrink-0" aria-hidden />
                        <div>
                          <p className="font-medium text-neutral-800 truncate max-w-xs">{doc.title}</p>
                          {doc.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {doc.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-micro bg-neutral-100 text-neutral-500 rounded px-1.5 py-0.5 flex items-center gap-1">
                                  <Tag className="h-2.5 w-2.5" aria-hidden />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</td>
                    <td className="px-4 py-3 text-neutral-500">{doc.language === "ar" ? "عربي" : doc.language === "en" ? "إنجليزي" : "ثنائي"}</td>
                    <td className="px-4 py-3">
                      {doc.isIndexed ? (
                        <span className="flex items-center gap-1 text-success-700 text-caption font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          مفهرسة
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-warning-700 text-caption font-medium">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          قيد الفهرسة
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 tabular-nums">
                      {doc.lastUsedAt ? formatDate(doc.lastUsedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 tabular-nums">
                      {doc.indexedAt ? formatDate(doc.indexedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
