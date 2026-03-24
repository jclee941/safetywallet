import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnmatchedTab } from "../unmatched-tab";

interface TableProps<T extends object> {
  columns: Array<{
    key: keyof T | string;
    render?: (item: T) => React.ReactNode;
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
        <div data-testid="row" key={JSON.stringify(item)}>
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
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe("UnmatchedTab", () => {
  it("renders site selection message when siteId is missing", () => {
    render(<UnmatchedTab siteId={null} records={[]} isLoading={false} />);

    expect(screen.getByText("현장을 선택해주세요.")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
  });

  it("renders records with table columns and unmatched badge", () => {
    render(
      <UnmatchedTab
        siteId="site-1"
        records={[
          {
            externalWorkerId: "EXT-123",
            siteName: "현장 A",
            checkinAt: "2026-03-01T00:00:00.000Z",
            source: "FAS",
          },
        ]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("이름, ID 검색...")).toBeInTheDocument();
    expect(screen.getByText("미매칭 기록이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("EXT-123")).toBeInTheDocument();
    expect(screen.getByText("현장: 현장 A")).toBeInTheDocument();
    expect(screen.getByText("현장 A")).toBeInTheDocument();
    expect(screen.getByText("미매칭")).toBeInTheDocument();
  });

  it("renders loading empty message and site fallback", () => {
    render(
      <UnmatchedTab
        siteId="site-1"
        records={[
          {
            externalWorkerId: "EXT-999",
            siteName: null,
            checkinAt: "2026-03-01T00:00:00.000Z",
            source: "MANUAL",
          },
        ]}
        isLoading
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
