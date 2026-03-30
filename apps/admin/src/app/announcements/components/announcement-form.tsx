"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button, Card, Input, toast } from "@safetywallet/ui";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useGenerateAnnouncementDraft } from "@/hooks/use-announcement-ai-draft";
import { useAuthStore } from "@/stores/auth";

interface AnnouncementFormProps {
  editingId: string | null;
  onSubmit: (data: {
    title: string;
    content: string;
    isPinned: boolean;
    scheduledAt: string | null;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function AnnouncementForm({
  editingId,
  onSubmit,
  onCancel,
  isSubmitting,
}: AnnouncementFormProps) {
  const generateDraft = useGenerateAnnouncementDraft();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [aiKeywords, setAiKeywords] = useState("");
  const [showAiInput, setShowAiInput] = useState(false);

  const handleGenerateDraft = async () => {
    if (!aiKeywords.trim() || !currentSiteId) {
      return;
    }

    try {
      const result = await generateDraft.mutateAsync({
        keywords: aiKeywords,
        siteId: currentSiteId,
      });

      setTitle(result.title);
      setContent(result.content);
      setShowAiInput(false);
      setAiKeywords("");
      toast({ description: "AI 초안이 생성되었습니다." });
    } catch (err) {
      toast({
        variant: "destructive",
        description:
          err instanceof Error ? err.message : "초안 생성에 실패했습니다.",
      });
    }
  };

  const handleSubmit = () => {
    if (!title || !content) return;
    onSubmit({ title, content, isPinned, scheduledAt: scheduledAt || null });
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {editingId ? "공지 수정" : "새 공지 작성"}
        </h2>
        {!editingId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAiInput((prev) => !prev)}
            disabled={generateDraft.isPending}
          >
            <Bot className="h-4 w-4" />
            AI 초안 생성
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {showAiInput && !editingId && (
          <div className="flex gap-2">
            <Input
              placeholder="키워드 입력 (예: 하절기 안전, 폭염 대비, 작업 중지)"
              value={aiKeywords}
              onChange={(e) => setAiKeywords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleGenerateDraft();
                }
              }}
            />
            <Button
              size="sm"
              disabled={generateDraft.isPending || !aiKeywords.trim()}
              onClick={() => void handleGenerateDraft()}
            >
              {generateDraft.isPending ? "생성 중..." : "생성"}
            </Button>
          </div>
        )}
        <Input
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <RichTextEditor
          placeholder="내용"
          content={content}
          onChange={setContent}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">상단 고정</span>
        </label>
        <div>
          <label
            htmlFor="announcement-scheduled-at"
            className="mb-1 block text-sm font-medium"
          >
            예약 발행
          </label>
          <input
            id="announcement-scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {scheduledAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              설정한 시간에 자동으로 발행됩니다.
              <button
                type="button"
                className="ml-2 text-destructive underline"
                onClick={() => setScheduledAt("")}
              >
                예약 취소
              </button>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!title || !content || isSubmitting}
          >
            {editingId ? "수정" : "등록"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </Card>
  );
}
