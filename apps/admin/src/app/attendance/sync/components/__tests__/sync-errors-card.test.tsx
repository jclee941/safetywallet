import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncErrorsCard } from "../sync-errors-card";
import { useSyncErrors } from "@/hooks/use-sync-errors";

interface TableProps<T extends object> {
  columns: Array<{
    key: keyof T | string;
    render?: (item: T) => ReactNode;
  }>;
  data: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

vi.mock("@/hooks/use-sync-errors", () => ({
  useSyncErrors: vi.fn(),
}));

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
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const mockUseSyncErrors = vi.mocked(useSyncErrors);

const toSyncErrorsResult = (value: unknown): ReturnType<typeof useSyncErrors> =>
  value as never;

describe("SyncErrorsCard", () => {
  beforeEach(() => {
    mockUseSyncErrors.mockReturnValue(
      toSyncErrorsResult({ data: { errors: [] }, isLoading: false }),
    );
  });

  it("requests OPEN sync errors and renders loading empty message", () => {
    mockUseSyncErrors.mockReturnValue(
      toSyncErrorsResult({ data: { errors: [] }, isLoading: true }),
    );

    render(<SyncErrorsCard />);

    expect(mockUseSyncErrors).toHaveBeenCalledWith({
      status: "OPEN",
      limit: 50,
    });
    expect(
      screen.getByText("OPEN 상태의 동기화 에러 목록"),
    ).toBeInTheDocument();
    expect(screen.getByText("에러 메시지 검색...")).toBeInTheDocument();
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders rows and fallback values", () => {
    mockUseSyncErrors.mockReturnValue(
      toSyncErrorsResult({
        isLoading: false,
        data: {
          errors: [
            {
              id: "e1",
              siteId: "site-1",
              syncType: "FAS_ATTENDANCE",
              status: "OPEN",
              errorCode: null,
              errorMessage: "failed sync",
              payload: null,
              retryCount: 3,
              lastRetryAt: null,
              resolvedAt: null,
              createdAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        },
      }),
    );

    render(<SyncErrorsCard />);

    expect(screen.getByText("FAS_ATTENDANCE")).toBeInTheDocument();
    expect(screen.getByText("failed sync")).toBeInTheDocument();
    expect(screen.getByText("3회")).toBeInTheDocument();
    expect(screen.getByText("미해결 에러가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
