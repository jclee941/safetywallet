"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useIssues,
  useCreateIssue,
  useIssueTemplates,
} from "@/hooks/use-issues-api";
import { IssueCreateDialog } from "./components/issue-create-dialog";
import { IssueCard } from "./components/issue-card";
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";

export default function IssuesPage() {
  const [stateFilter, setStateFilter] = useState("all");

  const {
    data: issues,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useIssues(stateFilter);
  const createIssue = useCreateIssue();
  const { data: templates, isLoading: templatesLoading } = useIssueTemplates();

  const errorMessage =
    error instanceof Error ? error.message : "이슈를 불러오지 못했습니다.";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">이슈 관리</h1>
        <IssueCreateDialog
          templates={templates}
          templatesLoading={templatesLoading}
          createIssue={createIssue}
        />
      </div>

      <div className="flex items-center gap-2">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px] [&>span]:truncate">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">열린 이슈</SelectItem>
            <SelectItem value="closed">닫힌 이슈</SelectItem>
            <SelectItem value="all">전체</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-8">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => refetch()}>
                다시 시도
              </Button>
              {isFetching && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !issues?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">등록된 이슈가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.number} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
