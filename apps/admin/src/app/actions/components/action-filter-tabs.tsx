"use client";

import { Button } from "@safetywallet/ui";

type FilterStatus =
  | ""
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "OVERDUE";

const filterTabs: { label: string; value: FilterStatus }[] = [
  { label: "전체", value: "" },
  { label: "배정됨", value: "ASSIGNED" },
  { label: "진행 중", value: "IN_PROGRESS" },
  { label: "완료", value: "COMPLETED" },
  { label: "확인됨", value: "VERIFIED" },
  { label: "기한초과", value: "OVERDUE" },
];

interface ActionFilterTabsProps {
  filter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  counts: {
    all: number;
    assigned: number;
    inProgress: number;
    completed: number;
    verified: number;
    overdue: number;
  };
}

export function ActionFilterTabs({
  filter,
  onFilterChange,
  counts,
}: ActionFilterTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {filterTabs.map((tab) => (
        <Button
          key={tab.value || "all"}
          type="button"
          variant={filter === tab.value ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(tab.value)}
        >
          {tab.label}
          {tab.value === "" && ` (${counts.all})`}
          {tab.value === "ASSIGNED" && ` (${counts.assigned})`}
          {tab.value === "IN_PROGRESS" && ` (${counts.inProgress})`}
          {tab.value === "COMPLETED" && ` (${counts.completed})`}
          {tab.value === "VERIFIED" && ` (${counts.verified})`}
          {tab.value === "OVERDUE" && ` (${counts.overdue})`}
        </Button>
      ))}
    </div>
  );
}
