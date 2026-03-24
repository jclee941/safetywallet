import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./page";
import { useStats } from "@/hooks/use-stats";
import {
  useAttendanceTrend,
  usePointsDistribution,
  usePostsTrend,
} from "@/hooks/use-trends";

const mockUseStats = vi.mocked(useStats);
const mockUsePostsTrend = vi.mocked(usePostsTrend);
const mockUseAttendanceTrend = vi.mocked(useAttendanceTrend);
const mockUsePointsDistribution = vi.mocked(usePointsDistribution);

const datePickerChange = vi.fn();
let currentSiteId: string | null = "site-1";

vi.mock("@/hooks/use-stats", () => ({ useStats: vi.fn() }));
vi.mock("@/hooks/use-trends", () => ({
  usePostsTrend: vi.fn(),
  useAttendanceTrend: vi.fn(),
  usePointsDistribution: vi.fn(),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string | null }) => unknown) =>
    selector({ currentSiteId }),
}));

vi.mock("./date-range-picker", () => ({
  getInitialDateRange: () => ({
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    preset: "30d",
  }),
  DateRangePicker: ({ onChange }: { onChange: (v: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        const next = {
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          preset: "custom",
        };
        datePickerChange(next);
        onChange(next);
      }}
    >
      change-range
    </button>
  ),
}));

vi.mock("./trend-chart", () => ({
  TrendChart: () => <div data-testid="trend-chart">trend</div>,
}));

vi.mock("./points-chart", () => ({
  PointsChart: () => <div data-testid="points-chart">points</div>,
}));

describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";

    mockUseStats.mockReturnValue({
      data: {
        totalUsers: 10,
        totalSites: 2,
        totalPosts: 100,
        activeUsersToday: 3,
        todayPostsCount: 5,
        pendingCount: 2,
        urgentCount: 1,
        avgProcessingHours: 3.5,
      },
      isLoading: false,
    } as never);

    mockUsePostsTrend.mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    mockUseAttendanceTrend.mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    mockUsePointsDistribution.mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
  });

  it("renders loading skeleton while stats query is loading", () => {
    mockUseStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<AnalyticsPage />);

    expect(screen.getByText("대시보드 분석")).toBeInTheDocument();
    expect(screen.queryByText("기간 필터")).not.toBeInTheDocument();
  });

  it("renders null when stats data is missing", () => {
    mockUseStats.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);

    const { container } = render(<AnalyticsPage />);
    expect(container.firstChild).toBeNull();
  });

  it("renders cards and charts when all data is ready", () => {
    render(<AnalyticsPage />);

    expect(screen.getByText("전체 사용자")).toBeInTheDocument();
    expect(screen.getByText("10명")).toBeInTheDocument();
    expect(screen.getByText("3.5시간")).toBeInTheDocument();
    expect(screen.getByText("기간 필터")).toBeInTheDocument();
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    expect(screen.getByTestId("points-chart")).toBeInTheDocument();
  });

  it("shows trend loading skeleton if any trend query is loading", () => {
    mockUsePostsTrend.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<AnalyticsPage />);

    expect(screen.queryByTestId("trend-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("points-chart")).not.toBeInTheDocument();
  });

  it("passes selected date range to trend hooks", () => {
    render(<AnalyticsPage />);
    fireEvent.click(screen.getByRole("button", { name: "change-range" }));

    expect(datePickerChange).toHaveBeenCalled();
    expect(mockUsePostsTrend).toHaveBeenLastCalledWith(
      "2026-01-01",
      "2026-01-31",
      "site-1",
    );
    expect(mockUseAttendanceTrend).toHaveBeenLastCalledWith(
      "2026-01-01",
      "2026-01-31",
      "site-1",
    );
    expect(mockUsePointsDistribution).toHaveBeenLastCalledWith(
      "2026-01-01",
      "2026-01-31",
      "site-1",
    );
  });

  it("passes undefined siteId when no site is selected", () => {
    currentSiteId = null;

    render(<AnalyticsPage />);

    expect(mockUsePostsTrend).toHaveBeenCalledWith(
      "2026-02-01",
      "2026-02-28",
      undefined,
    );
    expect(mockUseAttendanceTrend).toHaveBeenCalledWith(
      "2026-02-01",
      "2026-02-28",
      undefined,
    );
    expect(mockUsePointsDistribution).toHaveBeenCalledWith(
      "2026-02-01",
      "2026-02-28",
      undefined,
    );
  });

  it("formats non-integer and non-number stat values", () => {
    mockUseStats.mockReturnValue({
      data: {
        totalUsers: "N/A",
        totalSites: 2,
        totalPosts: 100,
        activeUsersToday: 3,
        todayPostsCount: 5,
        pendingCount: 2,
        urgentCount: 1,
        avgProcessingHours: 3.5,
      },
      isLoading: false,
    } as never);

    render(<AnalyticsPage />);

    expect(screen.getByText("N/A명")).toBeInTheDocument();
    expect(screen.getByText("3.5시간")).toBeInTheDocument();
  });
});
