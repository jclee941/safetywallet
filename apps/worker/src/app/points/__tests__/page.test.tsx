import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PointsPage from "@/app/points/page";
import { useAuth } from "@/hooks/use-auth";
import { usePoints } from "@/hooks/use-api";
import { useLeaderboard } from "@/hooks/use-leaderboard";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-api", () => ({ usePoints: vi.fn() }));
vi.mock("@/hooks/use-leaderboard", () => ({ useLeaderboard: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@/components/points-card", () => ({
  PointsCard: ({ balance }: { balance: number }) => <div>points:{balance}</div>,
}));

describe("app/points/page", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: "site-1",
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });
  });

  it("renders points and ranking table", () => {
    vi.mocked(usePoints).mockReturnValue({
      data: {
        data: { balance: 500, history: [] },
        success: true,
        timestamp: "",
      },
      isLoading: false,
    } as never);
    vi.mocked(useLeaderboard).mockReturnValue({
      data: {
        myRank: 1,
        leaderboard: [
          {
            userId: "u1",
            rank: 1,
            nameMasked: "홍*동",
            totalPoints: 500,
            isCurrentUser: true,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<PointsPage />);

    expect(screen.getByText("points:500")).toBeInTheDocument();
    expect(screen.getByText("홍*동")).toBeInTheDocument();
  });

  it("switches ranking tabs and shows empty history", () => {
    vi.mocked(usePoints).mockReturnValue({
      data: {
        data: { balance: 0, history: [] },
        success: true,
        timestamp: "",
      },
      isLoading: false,
    } as never);
    vi.mocked(useLeaderboard).mockReturnValue({
      data: { myRank: null, leaderboard: [] },
      isLoading: false,
    } as never);

    render(<PointsPage />);

    fireEvent.click(screen.getByRole("button", { name: "points.monthlyTab" }));
    fireEvent.click(
      screen.getByRole("button", { name: "points.cumulativeTab" }),
    );
    expect(screen.getByText("points.noRankingData")).toBeInTheDocument();
    expect(screen.getByText("points.noPointsHistory")).toBeInTheDocument();
  });

  it("renders rank badges and my-rank summary with history details", () => {
    vi.mocked(usePoints).mockReturnValue({
      data: {
        data: {
          balance: 1200,
          history: [
            {
              id: "h1",
              reasonText: "현장 개선",
              reasonCode: "IMPROVEMENT",
              createdAt: "2026-03-20T00:00:00Z",
              amount: 20,
            },
            {
              id: "h2",
              reasonText: "",
              reasonCode: "PENALTY",
              createdAt: "2026-03-21T00:00:00Z",
              amount: -10,
            },
          ],
        },
        success: true,
        timestamp: "",
      },
      isLoading: false,
    } as never);

    vi.mocked(useLeaderboard).mockReturnValue({
      data: {
        myRank: 12,
        leaderboard: [
          {
            userId: "u1",
            rank: 1,
            nameMasked: "김*수",
            totalPoints: 2200,
            isCurrentUser: false,
          },
          {
            userId: "u2",
            rank: 2,
            nameMasked: "이*희",
            totalPoints: 2000,
            isCurrentUser: false,
          },
          {
            userId: "u3",
            rank: 3,
            nameMasked: "박*민",
            totalPoints: 1800,
            isCurrentUser: false,
          },
          {
            userId: "u4",
            rank: 4,
            nameMasked: "홍*동",
            totalPoints: 1200,
            isCurrentUser: true,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<PointsPage />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("현장 개선")).toBeInTheDocument();
    expect(screen.getByText("PENALTY")).toBeInTheDocument();
    expect(screen.getByText("+20 P")).toBeInTheDocument();
    expect(screen.getByText("-10 P")).toBeInTheDocument();
    expect(screen.getAllByText("points.me").length).toBeGreaterThan(0);
  });

  it("renders loading skeletons and uses null/empty site fallbacks", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: null,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    const pointsHook = vi.mocked(usePoints);
    const leaderboardHook = vi.mocked(useLeaderboard);
    pointsHook.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    leaderboardHook.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<PointsPage />);

    expect(pointsHook).toHaveBeenCalledWith("");
    expect(leaderboardHook).toHaveBeenCalledWith(null, "cumulative");
    expect(screen.getByText("header")).toBeInTheDocument();
  });

  it("shows fallback my-rank summary when current user is absent", () => {
    vi.mocked(usePoints).mockReturnValue({
      data: {
        data: { balance: 0, history: [] },
      },
      isLoading: false,
    } as never);
    vi.mocked(useLeaderboard).mockReturnValue({
      data: {
        myRank: 11,
        leaderboard: [
          {
            userId: "u1",
            rank: 1,
            nameMasked: "김*수",
            totalPoints: 500,
            isCurrentUser: false,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<PointsPage />);

    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("0 P")).toBeInTheDocument();
    expect(screen.getAllByText("points.me").length).toBeGreaterThanOrEqual(1);
  });
});
