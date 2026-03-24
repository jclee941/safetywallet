import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PointsSettlementPage from "../page";
import {
  useSettlementStatus,
  useCreateSettlementSnapshot,
  useFinalizeSettlement,
} from "@/hooks/use-api";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
const snapshotMutateMock = vi.fn();
const finalizeMutateMock = vi.fn();
const refetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/points/settlement",
}));

vi.mock("@/hooks/use-api", () => ({
  useSettlementStatus: vi.fn(),
  useCreateSettlementSnapshot: vi.fn(),
  useFinalizeSettlement: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      data-variant={variant}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  toast: toastMock,
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    columns,
    data,
    emptyMessage,
  }: {
    columns: Array<{
      key: string;
      render?: (row: Record<string, unknown>) => ReactNode;
    }>;
    data: unknown[];
    emptyMessage: string;
  }) => (
    <div>
      {data.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        (data as Array<Record<string, unknown>>).map((row, index) => (
          <div key={String(row.id ?? index)}>
            {columns.map((column, columnIndex) => (
              <div
                key={`${String(row.id ?? index)}-${column.key}-${columnIndex}`}
              >
                {column.render
                  ? column.render(row)
                  : String(row[column.key] ?? "")}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  ),
}));

const mockUseSettlementStatus = vi.mocked(useSettlementStatus);
const mockUseCreateSettlementSnapshot = vi.mocked(useCreateSettlementSnapshot);
const mockUseFinalizeSettlement = vi.mocked(useFinalizeSettlement);

const toResult = (value: unknown): ReturnType<typeof useSettlementStatus> =>
  value as never;

describe("PointsSettlementPage", () => {
  beforeEach(() => {
    toastMock.mockReset();
    snapshotMutateMock.mockReset();
    finalizeMutateMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue(undefined);

    mockUseSettlementStatus.mockReturnValue(
      toResult({
        data: {
          snapshotTaken: false,
          disputeOpenCount: 0,
          finalized: false,
          disputes: [],
          history: [],
        },
        isLoading: false,
        refetch: refetchMock,
      }),
    );
    mockUseCreateSettlementSnapshot.mockReturnValue({
      mutate: snapshotMutateMock,
      isPending: false,
    } as never);
    mockUseFinalizeSettlement.mockReturnValue({
      mutate: finalizeMutateMock,
      isPending: false,
    } as never);
  });

  it("renders page title and month badge", () => {
    render(<PointsSettlementPage />);
    expect(screen.getByText("월말 정산")).toBeInTheDocument();
    // Month badge contains "대상 월: YYYY-MM"
    const badge = screen.getByText(/대상 월:/);
    expect(badge).toBeInTheDocument();
  });

  it("shows status grid with snapshot not taken", () => {
    render(<PointsSettlementPage />);
    expect(screen.getByText("미생성")).toBeInTheDocument();
    expect(screen.getByText("0건")).toBeInTheDocument();
    expect(screen.getByText("미확정")).toBeInTheDocument();
  });

  it("shows status grid with snapshot taken and finalized", () => {
    mockUseSettlementStatus.mockReturnValue(
      toResult({
        data: {
          snapshotTaken: true,
          disputeOpenCount: 3,
          finalized: true,
          disputes: [],
          history: [],
        },
        isLoading: false,
        refetch: vi.fn(),
      }),
    );
    render(<PointsSettlementPage />);
    const completedTexts = screen.getAllByText("완료");
    expect(completedTexts.length).toBe(2);
    expect(screen.getByText("3건")).toBeInTheDocument();
  });

  it("renders dispute/history table cell branches", () => {
    mockUseSettlementStatus.mockReturnValue(
      toResult({
        data: {
          snapshotTaken: true,
          disputeOpenCount: 1,
          finalized: false,
          disputes: [
            {
              id: "d-open",
              createdAt: "2026-03-01T00:00:00.000Z",
              title: "열린 분쟁",
              userName: null,
              status: "OPEN",
            },
            {
              id: "d-closed",
              createdAt: "2026-03-02T00:00:00.000Z",
              title: "닫힌 분쟁",
              userName: "관리자",
              status: "RESOLVED",
            },
          ],
          history: [
            {
              month: "2026-02",
              entryCount: 2,
              totalAmount: 1234,
              lastOccurredAt: "2026-02-28T10:30:00.000Z",
            },
          ],
        },
        isLoading: false,
        refetch: refetchMock,
      }),
    );

    render(<PointsSettlementPage />);

    expect(screen.getByText("열린 분쟁")).toBeInTheDocument();
    expect(screen.getByText("닫힌 분쟁")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("RESOLVED")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.getByText("1,234P")).toBeInTheDocument();
  });

  it("calls snapshot mutation and shows success toast", async () => {
    snapshotMutateMock.mockImplementation(
      (_payload: undefined, options: { onSuccess?: () => void }) => {
        void options.onSuccess?.();
      },
    );
    render(<PointsSettlementPage />);
    fireEvent.click(screen.getByText("월말 스냅샷 생성"));

    await waitFor(() => {
      expect(snapshotMutateMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "월말 스냅샷이 생성되었습니다.",
        }),
      );
    });
    expect(refetchMock).toHaveBeenCalled();
  });

  it("shows error toast on snapshot failure", async () => {
    snapshotMutateMock.mockImplementation(
      (_payload: undefined, options: { onError?: (e: Error) => void }) => {
        options.onError?.(new Error("서버 오류"));
      },
    );
    render(<PointsSettlementPage />);
    fireEvent.click(screen.getByText("월말 스냅샷 생성"));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: expect.stringContaining("서버 오류"),
        }),
      );
    });
  });

  it("calls finalize mutation and shows success toast", async () => {
    finalizeMutateMock.mockImplementation(
      (_payload: undefined, options: { onSuccess?: () => void }) => {
        void options.onSuccess?.();
      },
    );
    render(<PointsSettlementPage />);
    fireEvent.click(screen.getByText("월말 정산 확정"));

    await waitFor(() => {
      expect(finalizeMutateMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "월말 정산이 확정되었습니다." }),
      );
    });
    expect(refetchMock).toHaveBeenCalled();
  });

  it("shows error toast on finalize failure", async () => {
    finalizeMutateMock.mockImplementation(
      (_payload: undefined, options: { onError?: (e: Error) => void }) => {
        options.onError?.(new Error("최종 확정 실패"));
      },
    );

    render(<PointsSettlementPage />);
    fireEvent.click(screen.getByText("월말 정산 확정"));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "정산 확정 실패: 최종 확정 실패",
        }),
      );
    });
  });

  it("disables finalize button when disputes exist", () => {
    mockUseSettlementStatus.mockReturnValue(
      toResult({
        data: {
          snapshotTaken: true,
          disputeOpenCount: 2,
          finalized: false,
          disputes: [],
          history: [],
        },
        isLoading: false,
        refetch: vi.fn(),
      }),
    );
    render(<PointsSettlementPage />);
    const finalizeBtn = screen.getByText("월말 정산 확정");
    expect(finalizeBtn).toBeDisabled();
  });

  it("shows empty messages in data tables", () => {
    render(<PointsSettlementPage />);
    expect(screen.getByText("진행 중인 분쟁이 없습니다")).toBeInTheDocument();
    expect(screen.getByText("정산 이력이 없습니다")).toBeInTheDocument();
  });

  it("shows loading empty messages when settlement data is loading", () => {
    mockUseSettlementStatus.mockReturnValue(
      toResult({
        data: undefined,
        isLoading: true,
        refetch: refetchMock,
      }),
    );

    render(<PointsSettlementPage />);
    expect(screen.getAllByText("로딩 중...").length).toBeGreaterThanOrEqual(1);
  });

  it("disables action buttons while mutation is pending", () => {
    mockUseCreateSettlementSnapshot.mockReturnValue({
      mutate: snapshotMutateMock,
      isPending: true,
    } as never);

    render(<PointsSettlementPage />);
    expect(screen.getByText("월말 스냅샷 생성")).toBeDisabled();
    expect(screen.getByText("월말 정산 확정")).toBeDisabled();
  });
});
