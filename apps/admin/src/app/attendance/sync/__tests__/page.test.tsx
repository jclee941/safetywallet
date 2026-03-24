import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendanceSyncPage from "../page";
import { useFasSyncStatus } from "@/hooks/use-fas-sync";

const statusCardsMock = vi.fn();
const syncLogsCardMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/attendance/sync",
}));

vi.mock("@/hooks/use-fas-sync", () => ({
  useFasSyncStatus: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("../components/status-cards", () => ({
  StatusCards: ({
    syncStatus,
    isHealthy,
  }: {
    syncStatus: { fasStatus: string | null };
    isHealthy: boolean;
  }) => {
    statusCardsMock(syncStatus, isHealthy);
    return (
      <div data-testid="status-cards">{isHealthy ? "healthy" : "down"}</div>
    );
  },
}));

vi.mock("../components/manual-sync-card", () => ({
  ManualSyncCard: () => <div data-testid="manual-sync-card" />,
}));

vi.mock("../components/fas-search-card", () => ({
  FasSearchCard: () => <div data-testid="fas-search-card" />,
}));

vi.mock("../components/sync-errors-card", () => ({
  SyncErrorsCard: () => <div data-testid="sync-errors-card" />,
}));

vi.mock("../components/sync-logs-card", () => ({
  SyncLogsCard: ({ syncLogs }: { syncLogs: unknown[] }) => {
    syncLogsCardMock(syncLogs);
    return <div data-testid="sync-logs-card" />;
  },
}));

const mockUseFasSyncStatus = vi.mocked(useFasSyncStatus);

const toFasSyncStatusResult = (
  value: unknown,
): ReturnType<typeof useFasSyncStatus> => value as never;

describe("AttendanceSyncPage", () => {
  beforeEach(() => {
    statusCardsMock.mockReset();
    syncLogsCardMock.mockReset();
  });

  it("renders loading skeleton state", () => {
    mockUseFasSyncStatus.mockReturnValue(
      toFasSyncStatusResult({ data: undefined, isLoading: true }),
    );

    render(<AttendanceSyncPage />);

    expect(screen.getByText("FAS 연동 현황")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(5);
    expect(screen.queryByTestId("status-cards")).not.toBeInTheDocument();
  });

  it("renders cards and computes healthy status from normalized values", () => {
    mockUseFasSyncStatus.mockReturnValue(
      toFasSyncStatusResult({
        isLoading: false,
        data: {
          fasStatus: " Up ",
          lastFullSync: null,
          userStats: { total: 0, fasLinked: 0, missingPhone: 0, deleted: 0 },
          syncErrorCounts: { open: 0, resolved: 0, ignored: 0 },
          recentSyncLogs: [{ id: "l1" }],
        },
      }),
    );

    render(<AttendanceSyncPage />);

    expect(screen.getByTestId("status-cards")).toHaveTextContent("healthy");
    expect(screen.getByTestId("manual-sync-card")).toBeInTheDocument();
    expect(screen.getByTestId("fas-search-card")).toBeInTheDocument();
    expect(screen.getByTestId("sync-errors-card")).toBeInTheDocument();
    expect(screen.getByTestId("sync-logs-card")).toBeInTheDocument();
    expect(syncLogsCardMock).toHaveBeenCalledWith([{ id: "l1" }]);
  });

  it("treats non-whitelisted status as unhealthy and handles missing data", () => {
    mockUseFasSyncStatus.mockReturnValue(
      toFasSyncStatusResult({
        isLoading: false,
        data: {
          fasStatus: "down",
          lastFullSync: null,
          userStats: { total: 0, fasLinked: 0, missingPhone: 0, deleted: 0 },
          syncErrorCounts: { open: 0, resolved: 0, ignored: 0 },
          recentSyncLogs: [],
        },
      }),
    );

    const { rerender } = render(<AttendanceSyncPage />);
    expect(screen.getByTestId("status-cards")).toHaveTextContent("down");

    mockUseFasSyncStatus.mockReturnValue(
      toFasSyncStatusResult({
        isLoading: false,
        data: undefined,
      }),
    );

    rerender(<AttendanceSyncPage />);
    expect(screen.queryByTestId("status-cards")).not.toBeInTheDocument();
  });
});
