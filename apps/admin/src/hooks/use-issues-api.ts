import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./use-api-base";
import type { IssueTemplate } from "@/app/issues/issue-template";

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string; avatar_url: string };
}

interface CreateIssueInput {
  title: string;
  body?: string;
  labels?: string[];
  assignCodex?: boolean;
}

export function useIssues(state: string = "open") {
  return useQuery({
    queryKey: ["admin", "issues", state],
    queryFn: async () => {
      const issues = await apiFetch<GitHubIssue[]>(
        `/admin/issues?state=${state}&per_page=50`,
      );
      return issues;
    },
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const issue = await apiFetch<GitHubIssue>("/admin/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "issues"] });
    },
  });
}

export function useIssueTemplates() {
  return useQuery({
    queryKey: ["admin", "issues", "templates"],
    queryFn: async () => {
      const templates = await apiFetch<IssueTemplate[]>(
        "/admin/issues/templates",
      );
      return templates;
    },
    staleTime: 5 * 60 * 1000,
  });
}
