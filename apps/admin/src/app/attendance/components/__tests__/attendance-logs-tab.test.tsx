import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceLogsTab } from "../attendance-logs-tab";

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
      {data.map((item, rowIdx) => (
        <div data-testid={`row-${rowIdx + 1}`} key={JSON.stringify(item)}>
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
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    type?: string;
    onChange?: (e: { target: { value: string } }) => void;
  }) => (
    <input
      aria-label={type === "date" ? "date-input" : "input"}
      value={value}
      type={type}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
    />
  ),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

describe("AttendanceLogsTab", () => {
  it("renders site selection message when siteId is missing", () => {
    render(
      <AttendanceLogsTab
        siteId={null}
        allLogs={[]}
        isLoading={false}
        date="2026-03-01"
        setDate={vi.fn()}
        resultFilter="ALL"
        setResultFilter={vi.fn()}
        companyFilter="ALL"
        setCompanyFilter={vi.fn()}
      />,
    );

    expect(screen.getByText("현장을 선택해주세요.")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
  });

  it("filters logs by result and handles input/select interactions", () => {
    const setDate = vi.fn();
    const setResultFilter = vi.fn();
    const setCompanyFilter = vi.fn();

    render(
      <AttendanceLogsTab
        siteId="site-1"
        allLogs={[
          {
            userName: "홍길동",
            externalWorkerId: "EXT-1",
            result: "SUCCESS",
            checkinAt: "2026-03-01T00:00:00.000Z",
            source: "FAS",
          },
          {
            userName: null,
            externalWorkerId: null,
            result: "FAIL",
            checkinAt: "2026-03-01T01:00:00.000Z",
            source: "MANUAL",
          },
        ]}
        isLoading={false}
        date="2026-03-01"
        setDate={setDate}
        resultFilter="SUCCESS"
        setResultFilter={setResultFilter}
        companyFilter="ALL"
        setCompanyFilter={setCompanyFilter}
      />,
    );

    expect(screen.getByText("이름, 소속 검색...")).toBeInTheDocument();
    expect(screen.getByText("출근 기록이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("EXT-1")).toBeInTheDocument();
    const firstRow = screen.getByTestId("row-1");
    expect(within(firstRow).getByText("성공")).toBeInTheDocument();
    expect(screen.queryByTestId("row-2")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("date-input"), {
      target: { value: "2026-03-02" },
    });
    expect(setDate).toHaveBeenCalledWith("2026-03-02");

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[0], { target: { value: "FAIL" } });
    fireEvent.change(selects[1], { target: { value: "ALL" } });

    expect(setResultFilter).toHaveBeenCalledWith("FAIL");
    expect(setCompanyFilter).toHaveBeenCalledWith("ALL");
  });

  it("shows loading empty message and fail status rendering", () => {
    render(
      <AttendanceLogsTab
        siteId="site-1"
        allLogs={[
          {
            userName: null,
            externalWorkerId: null,
            result: "FAIL",
            checkinAt: "2026-03-01T01:00:00.000Z",
            source: "MANUAL",
          },
        ]}
        isLoading
        date="2026-03-01"
        setDate={vi.fn()}
        resultFilter="ALL"
        setResultFilter={vi.fn()}
        companyFilter="ALL"
        setCompanyFilter={vi.fn()}
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId("row-1")).getByText("실패"),
    ).toBeInTheDocument();
  });
});
