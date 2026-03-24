import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendancePage from "./page";
import { useAttendanceLogs } from "@/hooks/use-attendance";
import { useAuthStore } from "@/stores/auth";

const logsTabPropsMock = vi.fn();

vi.mock("@/hooks/use-attendance", () => ({
  useAttendanceLogs: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("./components/attendance-stats", () => ({
  AttendanceStats: ({
    total,
    success,
    fail,
  }: {
    total: number;
    success: number;
    fail: number;
  }) => (
    <div data-testid="attendance-stats">
      stats:{total}/success:{success}/fail:{fail}
    </div>
  ),
}));

vi.mock("./components/attendance-logs-tab", () => ({
  AttendanceLogsTab: (props: { isLoading: boolean }) => {
    logsTabPropsMock(props);
    return (
      <div data-testid="attendance-logs-tab">
        {props.isLoading ? "logs-loading" : "logs-tab"}
      </div>
    );
  },
}));

const mockUseAttendanceLogs = vi.mocked(useAttendanceLogs);
const mockUseAuthStore = vi.mocked(useAuthStore);

const toAttendanceLogsResult = (
  value: unknown,
): ReturnType<typeof useAttendanceLogs> => value as never;

describe("AttendancePage", () => {
  beforeEach(() => {
    logsTabPropsMock.mockReset();
    mockUseAuthStore.mockImplementation((selector) =>
      selector({
        currentSiteId: "site-1",
      } as Parameters<typeof selector>[0]),
    );

    mockUseAttendanceLogs.mockReturnValue(
      toAttendanceLogsResult({
        data: {
          logs: [
            {
              id: "log-1",
              userName: "홍길동",
              externalWorkerId: "worker-1",
              result: "SUCCESS",
              checkinAt: "2026-02-22T01:00:00.000Z",
            },
          ],
        },
        isLoading: false,
      }),
    );
  });

  it("renders attendance heading and default logs tab", () => {
    render(<AttendancePage />);

    expect(screen.getByText("출근 현황")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-stats")).toHaveTextContent(
      "stats:1/success:1/fail:0",
    );
    expect(screen.getByTestId("attendance-logs-tab")).toBeInTheDocument();
    expect(screen.getByText("연동 현황")).toBeInTheDocument();
  });

  it("deduplicates logs by worker and keeps earliest check-in", () => {
    mockUseAttendanceLogs.mockReturnValue(
      toAttendanceLogsResult({
        data: {
          logs: [
            {
              id: "log-1-late",
              userName: "홍길동",
              externalWorkerId: "worker-1",
              result: "SUCCESS",
              checkinAt: "2026-02-22T02:00:00.000Z",
            },
            {
              id: "log-1-early",
              userName: "홍길동",
              externalWorkerId: "worker-1",
              result: "SUCCESS",
              checkinAt: "2026-02-22T01:00:00.000Z",
            },
            {
              id: "log-fail",
              userName: "이몽룡",
              externalWorkerId: "worker-2",
              result: "FAIL",
              checkinAt: "2026-02-22T03:00:00.000Z",
            },
          ],
          pagination: { total: 10 },
        },
        isLoading: false,
      }),
    );

    render(<AttendancePage />);

    expect(screen.getByTestId("attendance-stats")).toHaveTextContent(
      "stats:10/success:1/fail:1",
    );

    expect(logsTabPropsMock).toHaveBeenCalled();
    const lastCall = logsTabPropsMock.mock.calls.at(-1)?.[0] as {
      allLogs: Array<{ id: string }>;
      siteId: string;
    };
    expect(lastCall.siteId).toBe("site-1");
    expect(lastCall.allLogs).toHaveLength(2);
    expect(lastCall.allLogs[0].id).toBe("log-1-early");
  });

  it("handles missing worker id and missing pagination total", () => {
    mockUseAttendanceLogs.mockReturnValue(
      toAttendanceLogsResult({
        data: {
          logs: [
            {
              id: "log-a",
              userName: "A",
              externalWorkerId: null,
              result: "SUCCESS",
              checkinAt: null,
            },
            {
              id: "log-b",
              userName: "B",
              externalWorkerId: null,
              result: "FAIL",
              checkinAt: null,
            },
          ],
        },
        isLoading: true,
      }),
    );

    render(<AttendancePage />);

    expect(screen.getByTestId("attendance-stats")).toHaveTextContent(
      "stats:2/success:1/fail:1",
    );
    const lastCall = logsTabPropsMock.mock.calls.at(-1)?.[0] as {
      allLogs: Array<{ id: string }>;
      isLoading: boolean;
    };
    expect(lastCall.allLogs).toHaveLength(2);
    expect(lastCall.isLoading).toBe(true);
  });

  it("passes loading state to logs tab and renders loading view", () => {
    mockUseAttendanceLogs.mockReturnValue(
      toAttendanceLogsResult({
        data: { logs: [] },
        isLoading: true,
      }),
    );

    render(<AttendancePage />);

    expect(screen.getByText("logs-loading")).toBeInTheDocument();
    const lastCall = logsTabPropsMock.mock.calls.at(-1)?.[0] as {
      isLoading: boolean;
    };
    expect(lastCall.isLoading).toBe(true);
  });
});
