import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryTab } from "../history-tab";
import { usePointsHistory, useRevokePoints } from "@/hooks/use-rewards";

const mutateMock = vi.fn();
const selectorState = { currentSiteId: "site-1" as string | null };

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <input
      value={value}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value } })
      }
      placeholder={placeholder}
    />
  ),
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        close-dialog
      </button>
      {open ? children : null}
    </div>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => string | null,
  ) => selector(selectorState),
}));

vi.mock("@/hooks/use-rewards", () => ({
  usePointsHistory: vi.fn(),
  useRevokePoints: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    data,
    columns,
    emptyMessage,
  }: {
    data: Array<Record<string, unknown>>;
    columns: Array<{
      key: string;
      render?: (row: Record<string, unknown>) => ReactNode;
      header: string;
    }>;
    emptyMessage: string;
    pageSize?: number;
  }) => (
    <div>
      <p>{emptyMessage}</p>
      {data.map((row) => (
        <div key={String(row.id)}>
          {columns.map((column, idx) => (
            <div key={`${String(row.id)}-${column.key}-${idx}`}>
              {column.render?.(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const mockUsePointsHistory = vi.mocked(usePointsHistory);
const mockUseRevokePoints = vi.mocked(useRevokePoints);

describe("HistoryTab", () => {
  beforeEach(() => {
    selectorState.currentSiteId = "site-1";
    mutateMock.mockReset();
    mockUseRevokePoints.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as never);
    mockUsePointsHistory.mockReturnValue({
      isLoading: false,
      data: {
        total: 40,
        entries: [
          {
            id: "m1",
            amount: 100,
            reason: "포상",
            createdAt: "2026-03-01T00:00:00.000Z",
            member: { user: { nameMasked: "홍길동" } },
          },
          {
            id: "m2",
            amount: -10,
            reason: "차감",
            createdAt: "2026-03-02T00:00:00.000Z",
            member: { user: { nameMasked: "임꺽정" } },
          },
        ],
      },
    } as never);
  });

  it("renders loading state", () => {
    mockUsePointsHistory.mockReturnValue({
      isLoading: true,
      data: undefined,
    } as never);
    render(<HistoryTab />);

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders rows and handles pagination controls", () => {
    render(<HistoryTab />);

    expect(screen.getByText("지급 내역")).toBeInTheDocument();
    expect(screen.getByText("+100P")).toBeInTheDocument();
    expect(screen.getByText("-10P")).toBeInTheDocument();
    expect(screen.getByText("총 40건")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    const navButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim() === "");
    expect(navButtons[0]).toBeDisabled();
    fireEvent.click(navButtons[1]);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.click(navButtons[0]);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("opens revoke dialog and revokes points on success", async () => {
    mutateMock.mockImplementation(
      (
        _payload: { memberId: string; amount: number; reason: string },
        options: { onSuccess?: () => void },
      ) => options.onSuccess?.(),
    );

    render(<HistoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "차감" }));
    expect(screen.getByText("포인트 차감")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("차감 사유를 입력하세요"), {
      target: { value: "오지급" },
    });
    fireEvent.click(screen.getByRole("button", { name: "차감 확인" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { memberId: "m1", amount: 100, reason: "오지급" },
        expect.objectContaining({}),
      );
    });

    expect(screen.queryByText("포인트 차감")).not.toBeInTheDocument();
  });

  it("uses default reason and blocks revoke when site is missing", async () => {
    const { unmount } = render(<HistoryTab />);
    fireEvent.click(screen.getByRole("button", { name: "차감" }));
    fireEvent.click(screen.getByRole("button", { name: "차감 확인" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { memberId: "m1", amount: 100, reason: "관리자 차감" },
        expect.objectContaining({}),
      );
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    unmount();
    mutateMock.mockClear();
    selectorState.currentSiteId = null;
    render(<HistoryTab />);
    fireEvent.click(screen.getByRole("button", { name: "차감" }));
    fireEvent.click(screen.getByRole("button", { name: "차감 확인" }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("disables confirm button when mutation is pending and closes dialog", () => {
    mockUseRevokePoints.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
    } as never);

    render(<HistoryTab />);
    fireEvent.click(screen.getByRole("button", { name: "차감" }));

    expect(screen.getByRole("button", { name: "차감 확인" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("포인트 차감")).not.toBeInTheDocument();
  });

  it("closes revoke dialog via dialog open change callback", () => {
    render(<HistoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "차감" }));
    expect(screen.getByText("포인트 차감")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));
    expect(screen.queryByText("포인트 차감")).not.toBeInTheDocument();
  });
});
