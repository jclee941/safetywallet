"use client";

import { Loader2 } from "lucide-react";
import type { IssueTemplate } from "../issue-template";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";

interface IssueTemplateSelectProps {
  templates?: IssueTemplate[];
  selectedSlug: string;
  isLoading: boolean;
  onTemplateChange: (slug: string) => void;
}

export function IssueTemplateSelect({
  templates,
  selectedSlug,
  isLoading,
  onTemplateChange,
}: IssueTemplateSelectProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        템플릿 로딩 중...
      </div>
    );
  }

  return (
    <Select value={selectedSlug} onValueChange={onTemplateChange}>
      <SelectTrigger className="[&>span]:truncate">
        <SelectValue placeholder="템플릿 선택" />
      </SelectTrigger>
      <SelectContent>
        {templates?.map((t) => (
          <SelectItem key={t.slug} value={t.slug}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
