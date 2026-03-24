"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { formatTime } from "../attendance-helpers";

interface AttendanceLog {
  userName: string | null;
  externalWorkerId: string | null;
  result: string;
  checkinAt: string;
  source: string;
}

interface AttendanceLogsTabProps {
  siteId: string | null;
  allLogs: AttendanceLog[];
  isLoading: boolean;
  date: string;
  setDate: (date: string) => void;
  resultFilter: "ALL" | "SUCCESS" | "FAIL";
  setResultFilter: (filter: "ALL" | "SUCCESS" | "FAIL") => void;
  companyFilter: string;
  setCompanyFilter: (filter: string) => void;
}

export function AttendanceLogsTab({
  siteId,
  allLogs,
  isLoading,
  date,
  setDate,
  resultFilter,
  setResultFilter,
  companyFilter,
  setCompanyFilter,
}: AttendanceLogsTabProps) {
  const companyNames = useMemo<string[]>(() => {
    // Company name not available from backend
    return [];
  }, []);

  const filteredLogs = useMemo(() => {
    let logs = allLogs;
    if (resultFilter !== "ALL") {
      logs = logs.filter((l) => l.result === resultFilter);
    }
    // Company filter disabled — backend does not return companyName

    return logs.map((log, i) => ({ ...log, index: i + 1 }));
  }, [allLogs, resultFilter]);

  const logColumns: Column<(typeof filteredLogs)[0]>[] = [
    {
      key: "index",
      header: "No",
      render: (item) => (
        <span className="text-muted-foreground">{item.index}</span>
      ),
      className: "w-[60px]",
    },
    {
      key: "user",
      header: "사용자",
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium">{item.userName || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {item.externalWorkerId || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "result",
      header: "상태",
      sortable: true,
      render: (item) => (item.result === "SUCCESS" ? "성공" : "실패"),
    },
    {
      key: "checkinAt",
      header: "출근시간",
      sortable: true,
      render: (item) => formatTime(item.checkinAt),
    },
    {
      key: "checkOutTime",
      header: "퇴근시간",
      sortable: true,
      render: () => "-",
    },
    {
      key: "source",
      header: "출처",
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.source}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>출근 목록</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[150px]"
            />
            <Select
              value={resultFilter}
              onValueChange={(val: "ALL" | "SUCCESS" | "FAIL") =>
                setResultFilter(val)
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="SUCCESS">성공</SelectItem>
                <SelectItem value="FAIL">실패</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="소속" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 소속</SelectItem>
                {companyNames.map((name) => (
                  <SelectItem key={name} value={name!}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!siteId ? (
          <div className="text-center py-8 text-muted-foreground">
            현장을 선택해주세요.
          </div>
        ) : (
          <DataTable
            columns={logColumns}
            data={filteredLogs}
            searchable
            searchPlaceholder="이름, 소속 검색..."
            emptyMessage={isLoading ? "로딩 중..." : "출근 기록이 없습니다."}
            pageSize={20}
          />
        )}
      </CardContent>
    </Card>
  );
}
