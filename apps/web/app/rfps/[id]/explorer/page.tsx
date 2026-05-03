"use client";

import { use, useState, useRef } from "react";
import useSWR from "swr";
import { rfpApi, decisionApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { Flag } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

const FLAG_COLOR: Record<string, string> = {
  RED: "border-danger-400 bg-danger-50",
  GREEN: "border-success-400 bg-success-50",
};

export default function ExplorerPage({ params }: Props) {
  const { id } = use(params);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [pdfPanel, setPdfPanel] = useState(true);

  const { data: rfp } = useSWR(`rfp-${id}`, () => rfpApi.get(id).then((r) => r.data));
  const { data: decision } = useSWR(`decision-${id}`, () => decisionApi.get(id).then((r) => r.data));

  const flags: Flag[] = decision?.flags ?? [];
  const filteredFlags = search
    ? flags.filter((f) =>
        f.titleAr?.toLowerCase().includes(search.toLowerCase()) ||
        f.titleEn?.toLowerCase().includes(search.toLowerCase()) ||
        f.evidenceQuote?.toLowerCase().includes(search.toLowerCase())
      )
    : flags;

  const totalPages = rfp?.totalPages ?? 1;

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
      {/* Flags panel */}
      <aside className="w-72 shrink-0 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 border-b border-neutral-100">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" aria-hidden />
            <input
              type="search"
              placeholder="بحث في الأدلة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 rounded-md border border-neutral-200 bg-neutral-50 ps-8 pe-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              aria-label="البحث في الأدلة"
            />
          </div>
        </div>

        <div className="flex gap-1 p-2 border-b border-neutral-100">
          {[
            { type: "ALL",   label: `الكل (${flags.length})` },
            { type: "RED",   label: `مخاطر (${flags.filter((f) => f.flagType === "RED").length})` },
            { type: "GREEN", label: `فرص (${flags.filter((f) => f.flagType === "GREEN").length})` },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setSearch(type === "ALL" ? "" : type === "RED" ? "" : "")}
              className="flex-1 h-7 text-caption rounded-md bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <ol className="flex-1 overflow-y-auto divide-y divide-neutral-50" aria-label="قائمة الأدلة">
          {filteredFlags.length === 0 ? (
            <li className="p-4 text-center text-body-sm text-neutral-400">لا توجد نتائج</li>
          ) : filteredFlags.map((flag) => (
            <li key={flag.id}>
              <button
                onClick={() => {
                  setSelectedFlag(flag);
                  if (flag.pageNumber) setPage(flag.pageNumber);
                }}
                className={cn(
                  "w-full text-start p-3 hover:bg-neutral-50 transition-colors",
                  selectedFlag?.id === flag.id && "bg-primary-50"
                )}
              >
                <div className="flex items-start gap-2">
                  {flag.flagType === "RED"
                    ? <AlertTriangle className="h-3.5 w-3.5 text-danger-500 shrink-0 mt-0.5" aria-label="مخاطرة" />
                    : <CheckCircle2 className="h-3.5 w-3.5 text-success-500 shrink-0 mt-0.5" aria-label="فرصة" />
                  }
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-neutral-800 leading-snug truncate">{flag.titleAr}</p>
                    {flag.severity && (
                      <span className={cn(
                        "text-micro font-medium rounded px-1 py-0.5 mt-0.5 inline-block",
                        flag.severity === "CRITICAL" ? "bg-danger-100 text-danger-700"
                          : flag.severity === "MAJOR" ? "bg-warning-100 text-warning-700"
                          : "bg-neutral-100 text-neutral-600"
                      )}>
                        {flag.severity === "CRITICAL" ? "حرج" : flag.severity === "MAJOR" ? "رئيسي" : "ثانوي"}
                      </span>
                    )}
                    {flag.pageNumber && (
                      <p className="text-caption text-neutral-400 mt-0.5">ص. {flag.pageNumber}</p>
                    )}
                  </div>
                </div>
                {flag.evidenceQuote && (
                  <blockquote className="mt-2 text-caption text-neutral-500 bg-neutral-50 rounded px-2 py-1 border-s-2 border-neutral-300 line-clamp-2">
                    {flag.evidenceQuote}
                  </blockquote>
                )}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* PDF viewer panel */}
      <div className="flex-1 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="h-10 border-b border-neutral-100 flex items-center gap-2 px-3 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-body-sm text-neutral-600 tabular-nums min-w-[80px] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 transition-colors"
            aria-label="تكبير"
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-caption text-neutral-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 transition-colors"
            aria-label="تصغير"
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* PDF frame */}
        <div className="flex-1 overflow-auto bg-neutral-100 flex items-start justify-center p-4">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
          >
            {/* In production this would use react-pdf or an iframe to serve the file from MinIO presigned URL */}
            <div className="w-[595px] bg-white shadow-md rounded relative min-h-[842px] flex items-center justify-center">
              {rfp ? (
                <div className="text-center text-neutral-400 space-y-2">
                  <p className="text-h4 font-medium text-neutral-600">{rfp.titleAr || rfp.titleEn}</p>
                  <p className="text-body-sm">صفحة {page} من {totalPages}</p>
                  <p className="text-caption text-neutral-300">
                    (عارض PDF يتطلب إعداد خادم MinIO بمفاتيح الوصول)
                  </p>
                </div>
              ) : (
                <div className="skeleton w-full h-full rounded absolute inset-0" />
              )}

              {/* Flag overlay markers */}
              {filteredFlags
                .filter((f) => f.pageNumber === page)
                .map((flag) => (
                  <button
                    key={flag.id}
                    onClick={() => setSelectedFlag(flag)}
                    className={cn(
                      "absolute end-0 top-8 me-2 border-s-2 px-2 py-1 rounded-sm text-caption max-w-[180px] text-start transition-all",
                      flag.flagType === "RED"
                        ? "border-danger-400 bg-danger-50 text-danger-700"
                        : "border-success-400 bg-success-50 text-success-700",
                      selectedFlag?.id === flag.id && "ring-2 ring-primary-400"
                    )}
                  >
                    {flag.titleAr}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Selected flag detail */}
        {selectedFlag && (
          <div className={cn(
            "border-t p-3 shrink-0",
            selectedFlag.flagType === "RED" ? "bg-danger-50 border-danger-200" : "bg-success-50 border-success-200"
          )}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-neutral-800">{selectedFlag.titleAr}</p>
                {selectedFlag.evidenceQuote && (
                  <blockquote className="text-caption text-neutral-600 mt-1 italic">"{selectedFlag.evidenceQuote}"</blockquote>
                )}
              </div>
              <button
                onClick={() => setSelectedFlag(null)}
                className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
