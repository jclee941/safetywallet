"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Switch,
} from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { useAdminPosts, type PostFilters, type Post } from "@/hooks/use-api";
import { ReviewStatus, Category } from "@safetywallet/types";
import { X } from "lucide-react";

const statusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: "접수됨",
  [ReviewStatus.IN_REVIEW]: "검토 중",
  [ReviewStatus.NEED_INFO]: "추가정보 필요",
  [ReviewStatus.APPROVED]: "승인됨",
  [ReviewStatus.REJECTED]: "거절됨",
  [ReviewStatus.URGENT]: "긴급",
};

const statusColors: Record<
  ReviewStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [ReviewStatus.PENDING]: "default",
  [ReviewStatus.IN_REVIEW]: "secondary",
  [ReviewStatus.NEED_INFO]: "outline",
  [ReviewStatus.APPROVED]: "default",
  [ReviewStatus.REJECTED]: "destructive",
  [ReviewStatus.URGENT]: "destructive",
};

const categoryLabels: Record<Category, string> = {
  [Category.HAZARD]: "위험요소",
  [Category.UNSAFE_BEHAVIOR]: "불안전 행동",
  [Category.INCONVENIENCE]: "불편사항",
  [Category.SUGGESTION]: "개선 제안",
  [Category.BEST_PRACTICE]: "모범 사례",
};

export default function PostsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<PostFilters>({
    category: undefined,
    riskLevel: undefined,
    reviewStatus: undefined,
    isUrgent: false,
    startDate: undefined,
    endDate: undefined,
  });

  const { data: posts = [], isLoading } = useAdminPosts(filters);

  const handleFilterChange = (
    key: keyof PostFilters,
    value: string | boolean | Date | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: undefined,
      riskLevel: undefined,
      reviewStatus: undefined,
      isUrgent: false,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const columns: Column<Post>[] = [
    {
      key: "category",
      header: "카테고리",
      render: (item) => categoryLabels[item.category] || item.category,
    },
    {
      key: "riskLevel",
      header: "위험도",
      render: (item) => item.riskLevel || "-",
    },
    {
      key: "author.nameMasked",
      header: "작성자",
    },
    {
      key: "createdAt",
      header: "제보일시",
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString("ko-KR"),
    },
    {
      key: "status",
      header: "처리상태",
      render: (item) => (
        <Badge variant={statusColors[item.status]}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">제보 관리</h1>
      </div>

      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            value={filters.category}
            onValueChange={(val: string) =>
              handleFilterChange("category", val === "ALL" ? undefined : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              {Object.keys(categoryLabels).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat as Category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.riskLevel}
            onValueChange={(val: string) =>
              handleFilterChange("riskLevel", val === "ALL" ? undefined : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="위험도 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              <SelectItem value="HIGH">높음</SelectItem>
              <SelectItem value="MEDIUM">중간</SelectItem>
              <SelectItem value="LOW">낮음</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.reviewStatus}
            onValueChange={(val: string) =>
              handleFilterChange(
                "reviewStatus",
                val === "ALL" ? undefined : val,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="상태 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              {Object.keys(statusLabels).map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabels[status as ReviewStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              긴급 제보만 보기
            </label>
            <Switch
              checked={filters.isUrgent}
              onCheckedChange={(checked: boolean) =>
                handleFilterChange("isUrgent", checked)
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">시작일</label>
            <Input
              type="date"
              value={
                filters.startDate
                  ? filters.startDate.toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                handleFilterChange(
                  "startDate",
                  e.target.value ? new Date(e.target.value) : undefined,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">종료일</label>
            <Input
              type="date"
              value={
                filters.endDate
                  ? filters.endDate.toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                handleFilterChange(
                  "endDate",
                  e.target.value ? new Date(e.target.value) : undefined,
                )
              }
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full md:w-auto"
            >
              <X className="mr-2 h-4 w-4" /> 필터 초기화
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={posts}
        searchable
        searchPlaceholder="제목, 작성자 검색..."
        onRowClick={(item) => router.push(`/posts/${item.id}`)}
        emptyMessage={isLoading ? "로딩 중..." : "조건에 맞는 제보가 없습니다"}
      />
    </div>
  );
}
