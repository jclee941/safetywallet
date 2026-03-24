import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";
import { useDashboardStats } from "@/hooks/use-api";

vi.mock("@/hooks/use-api", () => ({
  useDashboardStats: vi.fn(),
}));

const mockUseDashboardStats = vi.mocked(useDashboardStats);

const toDashboardStatsResult = (
  value: unknown,
): ReturnType<typeof useDashboardStats> => value as never;

function createMockQueryResult<T>(
  data: T,
  isLoading = false,
  isSuccess = true,
): {
  data: T;
  isLoading: boolean;
  isSuccess: boolean;
} {
  return {
    data,
    isLoading,
    isSuccess,
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockUseDashboardStats.mockReturnValue(
      toDashboardStatsResult({
        ...createMockQueryResult({
          todayPostsCount: 7,
          pendingCount: 3,
          urgentCount: 1,
          avgProcessingHours: 52,
          totalUsers: 30,
          totalPosts: 120,
          activeUsersToday: 12,
          totalSites: 4,
          categoryDistribution: {
            HAZARD: 0,
            UNSAFE_BEHAVIOR: 0,
            INCONVENIENCE: 0,
            SUGGESTION: 0,
            BEST_PRACTICE: 0,
          },
        }),
      }),
    );
  });

  it("shows loading state while dashboard stats are loading", () => {
    mockUseDashboardStats.mockReturnValue(
      toDashboardStatsResult(createMockQueryResult(undefined, true, false)),
    );

    render(<DashboardPage />);

    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.queryByText("오늘 제보")).not.toBeInTheDocument();
  });

  it("renders 3 KPI cards and backlog warning", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText("48시간 이상 미검토 건이 있습니다"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("오늘의 출근 현황")).toBeInTheDocument();
    expect(screen.getByText("오늘 제보")).toBeInTheDocument();
    expect(screen.getByText("미검토 건수")).toBeInTheDocument();
  });

  it("hides backlog warning when conditions are not met", () => {
    mockUseDashboardStats.mockReturnValue(
      toDashboardStatsResult({
        ...createMockQueryResult({
          todayPostsCount: 2,
          pendingCount: 0,
          urgentCount: 0,
          avgProcessingHours: 10,
          totalUsers: 10,
          totalPosts: 50,
          activeUsersToday: 5,
          totalSites: 1,
          categoryDistribution: {
            HAZARD: 0,
            UNSAFE_BEHAVIOR: 0,
            INCONVENIENCE: 0,
            SUGGESTION: 0,
            BEST_PRACTICE: 0,
          },
        }),
      }),
    );

    render(<DashboardPage />);

    expect(
      screen.queryByText("48시간 이상 미검토 건이 있습니다"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("오늘의 출근 현황")).toBeInTheDocument();
  });

  it("hides backlog warning when pending exists but hours are below threshold", () => {
    mockUseDashboardStats.mockReturnValue(
      toDashboardStatsResult({
        ...createMockQueryResult({
          todayPostsCount: 1,
          pendingCount: 2,
          urgentCount: 0,
          avgProcessingHours: 47,
          totalUsers: 10,
          totalPosts: 10,
          activeUsersToday: 2,
          totalSites: 1,
          categoryDistribution: {
            HAZARD: 0,
            UNSAFE_BEHAVIOR: 0,
            INCONVENIENCE: 0,
            SUGGESTION: 0,
            BEST_PRACTICE: 0,
          },
        }),
      }),
    );

    render(<DashboardPage />);
    expect(
      screen.queryByText("48시간 이상 미검토 건이 있습니다"),
    ).not.toBeInTheDocument();
  });

  it("renders fallback zero values when stats are missing", () => {
    mockUseDashboardStats.mockReturnValue(
      toDashboardStatsResult(createMockQueryResult(undefined, false, true)),
    );

    render(<DashboardPage />);

    expect(screen.getByText("오늘의 출근 현황")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(
      screen.queryByText("48시간 이상 미검토 건이 있습니다"),
    ).not.toBeInTheDocument();
  });
});
