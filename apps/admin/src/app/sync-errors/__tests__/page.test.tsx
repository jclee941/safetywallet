import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SyncErrorsPage from "../page";
import {
  useSyncErrors,
  useUpdateSyncErrorStatus,
} from "@/hooks/use-sync-errors";

const toastMock = vi.fn();
const updateStatusMock = vi.fn();
const selectHandlers: Array<(value: string) => void> = [];

type SyncErrorItem = {
  id: string;
  createdAt: string;
  syncType: "FAS_ATTENDANCE" | "FAS_WORKER" | "ATTENDANCE_MANUAL";
  errorCode?: string;
  errorMessage: string;
  status: "OPEN" | "RESOLVED" | "IGNORED";
  siteId?: string;
  retryCount: number;
};

type Column = {
  key: string;
  render?: (item: SyncErrorItem) => ReactNode;
};

vi.mock("@/hooks/use-sync-errors", () => ({
  useSyncErrors: vi.fn(),
  useUpdateSyncErrorStatus: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  toast: (payload: unknown) => toastMock(payload),
  Badge: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <span data-class={className}>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick?.({ stopPropagation: vi.fn() })}
    >
      {children}
    </button>
  ),
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => {
    if (onValueChange) {
      selectHandlers.push(onValueChange);
    }
    return <div>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode; value: string }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="confirm-dialog" data-open={open ? "true" : "false"}>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        close-confirm
      </button>
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => <button type="button">{children}</button>,
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    data,
    columns,
    emptyMessage,
    searchPlaceholder,
  }: {
    data: SyncErrorItem[];
    columns: Column[];
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyMessage?: string;
  }) => (
    <div>
      <p>{emptyMessage}</p>
      <p>{searchPlaceholder}</p>
      {data.map((item) => (
        <div key={item.id} data-testid={`row-${item.id}`}>
          {columns.map((column) => (
            <div key={`${item.id}-${column.key}`}>
              {column.render ? column.render(item) : ""}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const mockUseSyncErrors = vi.mocked(useSyncErrors);
const mockUseUpdateSyncErrorStatus = vi.mocked(useUpdateSyncErrorStatus);

const toSyncErrorsResult = (value: unknown): ReturnType<typeof useSyncErrors> =>
  value as never;

const errorsFixture: SyncErrorItem[] = [
  {
    id: "err-open",
    createdAt: "2026-03-01T00:00:00.000Z",
    syncType: "FAS_ATTENDANCE",
    errorCode: "E001",
    errorMessage: "open error",
    status: "OPEN",
    siteId: "site-1",
    retryCount: 1,
  },
  {
    id: "err-resolved",
    createdAt: "2026-03-02T00:00:00.000Z",
    syncType: "FAS_WORKER",
    errorCode: undefined,
    errorMessage: "resolved error",
    status: "RESOLVED",
    siteId: undefined,
    retryCount: 2,
  },
  {
    id: "err-ignored",
    createdAt: "2026-03-03T00:00:00.000Z",
    syncType: "ATTENDANCE_MANUAL",
    errorCode: "E003",
    errorMessage: "ignored error",
    status: "IGNORED",
    siteId: "site-2",
    retryCount: 3,
  },
];

describe("SyncErrorsPage (__tests__)", () => {
  beforeEach(() => {
    toastMock.mockReset();
    updateStatusMock.mockReset();
    selectHandlers.length = 0;

    mockUseSyncErrors.mockReturnValue(
      toSyncErrorsResult({
        data: {
          total: 3,
          errors: errorsFixture,
        },
        isLoading: false,
      }),
    );

    mockUseUpdateSyncErrorStatus.mockReturnValue({
      mutate: updateStatusMock,
      isPending: false,
    } as never);
  });

  it("queries with default filters and updates query params from select filters", () => {
    render(<SyncErrorsPage />);

    expect(mockUseSyncErrors).toHaveBeenCalledWith({
      status: "OPEN",
      syncType: undefined,
      limit: 100,
      offset: 0,
    });

    act(() => {
      selectHandlers[0]("ALL");
      selectHandlers[1]("FAS_WORKER");
    });

    expect(mockUseSyncErrors.mock.calls.at(-1)?.[0]).toEqual({
      status: undefined,
      syncType: "FAS_WORKER",
      limit: 100,
      offset: 0,
    });
  });

  it("renders loading state and table state with action branches", () => {
    mockUseSyncErrors.mockReturnValueOnce(
      toSyncErrorsResult({
        data: undefined,
        isLoading: true,
      }),
    );

    const { rerender } = render(<SyncErrorsPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    rerender(<SyncErrorsPage />);

    expect(screen.getByText("FAS 동기화 에러 관리")).toBeInTheDocument();
    expect(screen.getByText("총 3건")).toBeInTheDocument();
    expect(
      screen.getByText("에러 메시지 또는 코드 검색..."),
    ).toBeInTheDocument();

    expect(screen.getAllByText("RESOLVED").length).toBeGreaterThan(1);
    expect(screen.getAllByText("IGNORED").length).toBeGreaterThan(1);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);

    const badgeNodes = document.querySelectorAll("span[data-class]");
    expect(badgeNodes[0]).toHaveAttribute(
      "data-class",
      "bg-red-100 text-red-700 hover:bg-red-100",
    );
    expect(badgeNodes[1]).toHaveAttribute(
      "data-class",
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    );
    expect(badgeNodes[2]).toHaveAttribute(
      "data-class",
      "bg-slate-200 text-slate-700 hover:bg-slate-200",
    );
  });

  it("handles confirm action guard and success/error toasts", async () => {
    render(<SyncErrorsPage />);

    fireEvent.click(screen.getByRole("button", { name: "변경" }));
    expect(updateStatusMock).not.toHaveBeenCalled();

    updateStatusMock.mockImplementationOnce(
      (
        _payload: { id: string; status: "RESOLVED" | "IGNORED" },
        options?: { onSuccess?: () => void },
      ) => {
        options?.onSuccess?.();
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "RESOLVED" }));
    expect(screen.getByText(/RESOLVED\(으\)로/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "변경" }));

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenNthCalledWith(
        1,
        { id: "err-open", status: "RESOLVED" },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "상태가 업데이트되었습니다." }),
      );
    });

    updateStatusMock.mockImplementationOnce(
      (
        _payload: { id: string; status: "RESOLVED" | "IGNORED" },
        options?: { onError?: (error: Error) => void },
      ) => {
        options?.onError?.(new Error("failed update"));
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "IGNORED" }));
    fireEvent.click(screen.getByRole("button", { name: "변경" }));

    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenNthCalledWith(
        2,
        { id: "err-open", status: "IGNORED" },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "상태 업데이트 실패: failed update",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "close-confirm" }));
    expect(screen.getByTestId("confirm-dialog")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
