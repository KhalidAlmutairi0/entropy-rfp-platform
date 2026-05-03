"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { cn, fileSizeHuman } from "@/lib/utils";

export type FileEntry = {
  file: File;
  fileType: "MAIN" | "ANNEX" | "CONTRACT" | "PRICING" | "OTHER";
  uploadProgress: number;
  status: "pending" | "uploading" | "done" | "error";
  ocrWarning?: boolean;
};

interface FileUploaderProps {
  onFilesChange: (files: FileEntry[]) => void;
  maxTotalMB?: number;
  maxFiles?: number;
  className?: string;
}

const FILE_TYPE_OPTIONS = [
  { value: "MAIN",    label: "المستند الرئيسي" },
  { value: "ANNEX",   label: "ملحق" },
  { value: "CONTRACT",label: "العقد" },
  { value: "PRICING", label: "الأسعار" },
  { value: "OTHER",   label: "أخرى" },
] as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/tiff", "image/bmp"];

export function FileUploader({ onFilesChange, maxTotalMB = 500, maxFiles = 20, className }: FileUploaderProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateEntries = (updated: FileEntry[]) => {
    setEntries(updated);
    onFilesChange(updated);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    const totalBytes = [...entries, ...acceptedFiles].reduce((acc, f) => acc + ("size" in f ? f.size : (f as FileEntry).file.size), 0);
    if (totalBytes > maxTotalMB * 1024 * 1024) {
      setError(`الحجم الكلي يتجاوز ${maxTotalMB} ميغابايت`);
      return;
    }

    const newEntries: FileEntry[] = acceptedFiles.map((file, idx) => ({
      file,
      fileType: idx === 0 && entries.length === 0 ? "MAIN" : "ANNEX",
      uploadProgress: 0,
      status: "pending",
      ocrWarning: IMAGE_TYPES.includes(file.type),
    }));

    updateEntries([...entries, ...newEntries]);
  }, [entries]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/zip": [".zip"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles,
  });

  const removeFile = (idx: number) => {
    updateEntries(entries.filter((_, i) => i !== idx));
  };

  const updateFileType = (idx: number, fileType: FileEntry["fileType"]) => {
    const updated = entries.map((e, i) => i === idx ? { ...e, fileType } : e);
    updateEntries(updated);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary-500 bg-primary-50"
            : "border-neutral-200 hover:border-primary-400 hover:bg-neutral-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-neutral-300 mx-auto mb-3" aria-hidden />
        <p className="text-body font-medium text-neutral-600">
          {isDragActive ? "أسقط الملفات هنا" : "اسحب الملفات وأسقطها هنا"}
        </p>
        <p className="text-body-sm text-neutral-400 mt-1">أو انقر للتصفح</p>
        <p className="text-caption text-neutral-400 mt-2">
          PDF، DOCX، ZIP · الحد الأقصى {maxTotalMB} ميغابايت · حتى {maxFiles} ملفات
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2 text-body-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <ul className="space-y-2" aria-label="الملفات المرفوعة">
          {entries.map((entry, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2"
            >
              {entry.ocrWarning ? (
                <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0" aria-label="يتطلب OCR" />
              ) : entry.status === "done" ? (
                <CheckCircle className="h-4 w-4 text-success-500 shrink-0" aria-label="مكتمل" />
              ) : (
                <FileText className="h-4 w-4 text-neutral-400 shrink-0" aria-hidden />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium truncate">{entry.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-caption text-neutral-400">{fileSizeHuman(entry.file.size)}</span>
                  {entry.ocrWarning && (
                    <span className="text-caption text-warning-700">قد يتطلب OCR</span>
                  )}
                </div>
                {entry.status === "uploading" && (
                  <div className="mt-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all"
                      style={{ width: `${entry.uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* File type selector */}
              <select
                value={entry.fileType}
                onChange={(e) => updateFileType(idx, e.target.value as FileEntry["fileType"])}
                className="text-body-sm border border-neutral-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-600"
                aria-label={`نوع الملف: ${entry.file.name}`}
              >
                {FILE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <button
                onClick={() => removeFile(idx)}
                className="text-neutral-400 hover:text-danger-500 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
                aria-label={`إزالة ${entry.file.name}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
