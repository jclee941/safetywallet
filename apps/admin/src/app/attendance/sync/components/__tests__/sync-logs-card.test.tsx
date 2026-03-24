import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncLogsCard } from "../sync-logs-card";

interface TableProps<T extends object> {
  columns: Array<{
    key: keyof T | string;
    render?: (item: T) => ReactNode;
  }>;
  data: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

vi.mock("@/components/data-table", () => ({
  DataTable: <T extends object>({
    columns,
    data,
    searchPlaceholder,
    emptyMessage,
  }: TableProps<T>) => (
    <div data-testid="data-table">
      <span>{searchPlaceholder}</span>
      <span>{emptyMessage}</span>
      {data.map((item) => (
        <div key={JSON.stringify(item)}>
          {columns.map((col) => (
            <div key={String(col.key)}>
              {col.render
                ? col.render(item)
                : String(
                    (item as Record<string, unknown>)[String(col.key)] ?? "-",
                  )}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
}));

describe("SyncLogsCard", () => {
  it("renders mapped action labels and fallback values", () => {
    render(
      <SyncLogsCard
        syncLogs={[
          {
            id: "1",
            action: "FAS_SYNC_COMPLETED",
            reason: "done",
            createdAt: "2026-03-01T00:00:00.000Z",
          },
          {
            id: "2",
            action: "UNKNOWN_ACTION",
            reason: null,
            createdAt: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("최근 동기화 로그")).toBeInTheDocument();
    expect(
      screen.getByText("최근 20건의 FAS 동기화 작업 기록"),
    ).toBeInTheDocument();
    expect(screen.getByText("로그 검색...")).toBeInTheDocument();
    expect(screen.getByText("동기화 로그가 없습니다.")).toBeInTheDocument();

    expect(screen.getByText("동기화 완료")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN_ACTION")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
