"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { proposalApi } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { MessageSquare, CheckCircle2, Clock, AlertCircle, Send, Loader2, User } from "lucide-react";
import type { ProposalSection } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  resolved: boolean;
  sectionId?: string;
}

export default function ReviewPage({ params }: Props) {
  const { id } = use(params);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const { data: proposal, isLoading } = useSWR(
    `proposal-${id}`,
    () => proposalApi.get(id).then((r) => r.data)
  );

  const sections: ProposalSection[] = proposal?.sections ?? [];
  // In production, comments come from a dedicated API; we use mock data here
  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      author: "فيصل الحارثي",
      content: "يجب ذكر شهادة ISO 27001 بشكل صريح في قسم الامتثال",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      resolved: false,
      sectionId: sections[0]?.id,
    },
  ]);

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 400)); // simulate API
    setComments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        author: "أنت",
        content: comment.trim(),
        createdAt: new Date().toISOString(),
        resolved: false,
        sectionId: selectedSection ?? undefined,
      },
    ]);
    setComment("");
    setSending(false);
  };

  const resolveComment = (commentId: string) => {
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: true } : c));
  };

  const unresolvedCount = comments.filter((c) => !c.resolved).length;
  const sectionComments = selectedSection
    ? comments.filter((c) => c.sectionId === selectedSection)
    : comments;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
      {/* Sections with comment counts */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 border-b border-neutral-100">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-neutral-700">الأقسام</span>
            {unresolvedCount > 0 && (
              <span className="text-caption bg-warning-50 text-warning-700 border border-warning-200 rounded-full px-2 py-0.5 font-medium">
                {unresolvedCount} معلق
              </span>
            )}
          </div>
        </div>
        <ol className="flex-1 overflow-y-auto divide-y divide-neutral-50">
          <li>
            <button
              onClick={() => setSelectedSection(null)}
              className={cn(
                "w-full text-start px-3 py-2.5 flex items-center gap-2 transition-colors",
                !selectedSection ? "bg-primary-50" : "hover:bg-neutral-50"
              )}
            >
              <span className={cn("text-body-sm flex-1", !selectedSection ? "text-primary-700 font-medium" : "text-neutral-700")}>
                كل التعليقات
              </span>
              {unresolvedCount > 0 && (
                <span className="text-caption bg-warning-100 text-warning-700 rounded-full px-1.5 font-medium">{unresolvedCount}</span>
              )}
            </button>
          </li>
          {sections.map((section) => {
            const count = comments.filter((c) => c.sectionId === section.id && !c.resolved).length;
            return (
              <li key={section.id}>
                <button
                  onClick={() => setSelectedSection(section.id)}
                  className={cn(
                    "w-full text-start px-3 py-2.5 flex items-center gap-2 transition-colors",
                    selectedSection === section.id ? "bg-primary-50" : "hover:bg-neutral-50"
                  )}
                >
                  <span className={cn("text-body-sm flex-1 leading-snug", selectedSection === section.id ? "text-primary-700 font-medium" : "text-neutral-700")}>
                    {section.titleAr}
                  </span>
                  {count > 0 && (
                    <span className="text-caption bg-warning-100 text-warning-700 rounded-full px-1.5 font-medium shrink-0">{count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Comments panel */}
      <div className="flex-1 flex flex-col bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        <div className="h-10 border-b border-neutral-100 flex items-center px-4 shrink-0">
          <MessageSquare className="h-4 w-4 text-neutral-400 me-2" aria-hidden />
          <span className="text-body-sm font-medium text-neutral-700">
            التعليقات {selectedSection ? `— ${sections.find((s) => s.id === selectedSection)?.titleAr}` : ""}
          </span>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sectionComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-neutral-200 mb-3" aria-hidden />
              <p className="text-body-sm text-neutral-500">لا توجد تعليقات</p>
              <p className="text-caption text-neutral-400 mt-1">أضف تعليقاً للمراجعة والنقاش</p>
            </div>
          ) : sectionComments.map((c) => (
            <div
              key={c.id}
              className={cn(
                "bg-neutral-50 border rounded-lg p-3",
                c.resolved ? "border-neutral-100 opacity-60" : "border-neutral-200"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary-600" aria-hidden />
                  </div>
                  <span className="text-body-sm font-medium text-neutral-800">{c.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-neutral-400">{formatRelativeTime(c.createdAt)}</span>
                  {c.resolved ? (
                    <span className="flex items-center gap-1 text-caption text-success-600">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      محلول
                    </span>
                  ) : (
                    <button
                      onClick={() => resolveComment(c.id)}
                      className="text-caption text-neutral-400 hover:text-success-600 transition-colors"
                    >
                      تأكيد الحل
                    </button>
                  )}
                </div>
              </div>
              <p className="text-body-sm text-neutral-700 mt-2 leading-relaxed">{c.content}</p>
              {c.sectionId && !selectedSection && (
                <p className="text-caption text-neutral-400 mt-1.5">
                  القسم: {sections.find((s) => s.id === c.sectionId)?.titleAr}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Add comment */}
        <div className="border-t border-neutral-100 p-3 bg-white shrink-0">
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="أضف تعليقاً..."
              rows={2}
              className="flex-1 rounded-md border border-neutral-200 px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSendComment();
              }}
              aria-label="إضافة تعليق"
            />
            <button
              onClick={handleSendComment}
              disabled={!comment.trim() || sending}
              className="h-full px-3 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              aria-label="إرسال التعليق"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <p className="text-caption text-neutral-400 mt-1.5">Ctrl + Enter للإرسال</p>
        </div>
      </div>
    </div>
  );
}
