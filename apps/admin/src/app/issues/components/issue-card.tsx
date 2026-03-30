"use client";

import { ExternalLink, CircleDot, CheckCircle2 } from "lucide-react";
import type { GitHubIssue } from "@/hooks/use-issues-api";
import { Badge } from "@safetywallet/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@safetywallet/ui";

interface IssueCardProps {
  issue: GitHubIssue;
}

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {issue.state === "open" ? (
              <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
            )}
            <div>
              <CardTitle className="text-base">
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {issue.title}
                </a>
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  #{issue.number}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                {new Date(issue.created_at).toLocaleDateString("ko-KR")} ·{" "}
                {issue.user?.login}
              </CardDescription>
            </div>
          </div>
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </a>
        </div>
      </CardHeader>
      {(issue.labels?.length > 0 || issue.body) && (
        <CardContent className="pt-0">
          {issue.labels?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge
                  key={label.name}
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: `#${label.color}`,
                    color: `#${label.color}`,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          )}
          {issue.body && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {issue.body}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
