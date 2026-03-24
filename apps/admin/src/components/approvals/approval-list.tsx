"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import {
  useManualApprovals,
  type ManualApproval,
  useApproveManualRequest,
} from "@/hooks/use-api";
import { Button, Badge, toast } from "@safetywallet/ui";
import { RejectDialog } from "./reject-dialog";

interface ApprovalListProps {
  siteId?: string;
  status: "PENDING" | "HISTORY";
  selectable?: boolean;
}

export function ApprovalList({
  siteId,
  status,
  selectable,
}: ApprovalListProps) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<ManualApproval[]>([]);

  const apiStatus = status === "PENDING" ? "PENDING" : undefined;

  const { data: approvals = [], isLoading } = useManualApprovals(
    siteId,
    undefined,
    apiStatus,
  );

  const filteredApprovals =
    status === "HISTORY"
      ? approvals.filter((a) => a.status !== "PENDING")
      : approvals;

  const approveMutation = useApproveManualRequest();

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => {
        toast({ description: "승인되었습니다." });
      },
      onError: (err) => {
        toast({ variant: "destructive", description: err.message });
      },
    });
  };

  const handleBulkApprove = () => {
    if (!selectedItems.length) return;

    Promise.all(
      selectedItems.map((item) => approveMutation.mutateAsync(item.id)),
    )
      .then(() => {
        toast({ description: `${selectedItems.length}건 승인되었습니다.` });
        setSelectedItems([]);
      })
      .catch((err) => {
        toast({
          variant: "destructive",
          description: "일부 승인 실패: " + err.message,
        });
      });
  };

  const columns: Column<ManualApproval>[] = [
    {
      key: "user.name",
      header: "작업자",
      sortable: true,
      render: (item) =>
        `${item.user.name || "-"} (${item.user.companyName || "-"})`,
    },
    {
      key: "reason",
      header: "사유",
      className: "max-w-xs truncate",
    },
    {
      key: "validDate",
      header: "유효 날짜",
      sortable: true,
      render: (item) => new Date(item.validDate).toLocaleDateString("ko-KR"),
    },
    {
      key: "status",
      header: "상태",
      render: (item) => {
        const variant =
          item.status === "APPROVED"
            ? "default"
            : item.status === "REJECTED"
              ? "destructive"
              : "secondary";
        const label =
          item.status === "APPROVED"
            ? "승인됨"
            : item.status === "REJECTED"
              ? "거절됨"
              : "대기중";
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: "createdAt",
      header: "신청일",
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleString("ko-KR"),
    },
  ];

  if (status === "PENDING") {
    columns.push({
      key: "actions",
      header: "관리",
      render: (item) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(item.id);
            }}
            disabled={approveMutation.isPending}
          >
            승인
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={(e) => {
              e.stopPropagation();
              setRejectId(item.id);
            }}
          >
            거절
          </Button>
        </div>
      ),
    });
  } else {
    columns.push({
      key: "approvedBy.name",
      header: "처리자",
      render: (item) => item.approvedBy?.name || "-",
    });
    columns.push({
      key: "rejectionReason",
      header: "거절 사유",
      render: (item) => item.rejectionReason || "-",
    });
  }

  return (
    <div className="space-y-4">
      {status === "PENDING" && selectedItems.length > 0 && (
        <div className="bg-muted p-2 rounded-md flex items-center justify-between">
          <span className="text-sm font-medium ml-2">
            {selectedItems.length}개 선택됨
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={approveMutation.isPending}
            >
              일괄 승인
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredApprovals}
        searchable
        searchPlaceholder="이름, 사유 검색..."
        emptyMessage={isLoading ? "로딩 중..." : "데이터가 없습니다"}
        selectable={selectable && status === "PENDING"}
        onSelectionChange={setSelectedItems}
      />

      {rejectId && (
        <RejectDialog
          isOpen={!!rejectId}
          onClose={() => setRejectId(null)}
          approvalId={rejectId}
        />
      )}
    </div>
  );
}
