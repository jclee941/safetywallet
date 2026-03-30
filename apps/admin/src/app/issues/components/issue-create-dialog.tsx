"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Loader2, Bot } from "lucide-react";
import type { IssueTemplate } from "../issue-template";
import { buildIssueBody } from "../issue-template";
import { getDefaultFieldValues } from "../utils";
import { IssueTemplateSelect } from "./issue-template-select";
import type { GitHubIssue } from "@/hooks/use-issues-api";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@safetywallet/ui";

interface IssueCreateDialogProps {
  templates?: IssueTemplate[];
  templatesLoading: boolean;
  createIssue: {
    mutateAsync: (input: {
      title: string;
      body: string;
      labels: string[];
      assignCodex: boolean;
    }) => Promise<GitHubIssue>;
    isPending: boolean;
  };
}

export function IssueCreateDialog({
  templates,
  templatesLoading,
  createIssue,
}: IssueCreateDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [assignCodex, setAssignCodex] = useState(true);

  const { toast } = useToast();

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.slug === selectedSlug),
    [templates, selectedSlug],
  );

  // Auto-select first template on load
  useEffect(() => {
    if (templates?.length && !selectedSlug) {
      setSelectedSlug(templates[0].slug);
      setFieldValues(getDefaultFieldValues(templates[0]));
    }
  }, [templates, selectedSlug]);

  const handleTemplateChange = (slug: string) => {
    setSelectedSlug(slug);
    const tpl = templates?.find((t) => t.slug === slug);
    if (tpl) setFieldValues(getDefaultFieldValues(tpl));
  };

  const handleFieldChange = (id: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  const submitDisabled = useMemo(() => {
    if (createIssue.isPending || !title.trim() || !selectedTemplate)
      return true;
    return selectedTemplate.fields.some(
      (f) => f.required && !fieldValues[f.id]?.trim(),
    );
  }, [createIssue.isPending, title, selectedTemplate, fieldValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitDisabled || !selectedTemplate) return;

    try {
      const formattedBody = buildIssueBody(
        selectedTemplate.fields,
        fieldValues,
      );
      const labels = [...selectedTemplate.labels];

      await createIssue.mutateAsync({
        title: title.trim(),
        body: formattedBody,
        labels,
        assignCodex,
      });

      toast({ description: "이슈가 등록되었습니다." });
      setTitle("");
      setFieldValues(getDefaultFieldValues(selectedTemplate));
      setAssignCodex(true);
      setDialogOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        description:
          err instanceof Error ? err.message : "이슈 등록에 실패했습니다.",
      });
    }
  };

  const dropdownFields =
    selectedTemplate?.fields.filter((f) => f.type === "dropdown") ?? [];
  const textareaFields =
    selectedTemplate?.fields.filter((f) => f.type === "textarea") ?? [];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          이슈 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>새 이슈 등록</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto px-1"
        >
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              GitHub 템플릿과 동일한 형식으로 이슈를 작성합니다.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">템플릿</label>
            <IssueTemplateSelect
              templates={templates}
              selectedSlug={selectedSlug}
              isLoading={templatesLoading}
              onTemplateChange={handleTemplateChange}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              제목
            </label>
            <Input
              id="title"
              placeholder="이슈 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {selectedTemplate && (
            <>
              {dropdownFields.length > 0 && (
                <div className="flex gap-4">
                  {dropdownFields.map((field) => (
                    <div key={field.id} className="space-y-2 flex-1">
                      <label className="text-sm font-medium">
                        {field.label}
                      </label>
                      <Select
                        value={fieldValues[field.id] || ""}
                        onValueChange={(v) => handleFieldChange(field.id, v)}
                      >
                        <SelectTrigger className="[&>span]:truncate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
              {textareaFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label htmlFor={field.id} className="text-sm font-medium">
                    {field.label}
                    {!field.required && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        (선택)
                      </span>
                    )}
                  </label>
                  {field.description && (
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                  <textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    value={fieldValues[field.id] || ""}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.value)
                    }
                    rows={field.required ? 3 : 2}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required={field.required}
                  />
                </div>
              ))}
            </>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="assignCodex"
              checked={assignCodex}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAssignCodex(e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <label
              htmlFor="assignCodex"
              className="flex items-center gap-1.5 text-sm"
            >
              <Bot className="h-4 w-4" />
              Codex 자동 할당
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={submitDisabled}>
            {createIssue.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                등록 중...
              </>
            ) : (
              "이슈 등록"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
