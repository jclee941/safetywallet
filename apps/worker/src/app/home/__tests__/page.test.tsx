import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/home/page";
import { useAuth } from "@/hooks/use-auth";
import { usePosts, usePoints, useAttendanceToday } from "@/hooks/use-api";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useQuery } from "@tanstack/react-query";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-api", () => ({
  usePosts: vi.fn(),
  usePoints: vi.fn(),
  useAttendanceToday: vi.fn(),
}));
vi.mock("@/hooks/use-leaderboard", () => ({ useLeaderboard: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
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
vi.mock("@/components/ranking-card", () => ({
  RankingCard: ({ myRank }: { myRank: number | null }) => (
    <div>rank:{myRank ?? "none"}</div>
  ),
}));
vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string } }) => (
    <div>post-card:{post.id}</div>
  ),
}));

describe("app/home/page", () => {
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
    vi.mocked(usePosts).mockReturnValue({
      data: { data: { posts: [] }, success: true, timestamp: "" },
      isLoading: false,
    } as never);
    vi.mocked(usePoints).mockReturnValue({
      data: {
        data: { balance: 1200, history: [] },
        success: true,
        timestamp: "",
      },
      isLoading: false,
    } as never);
    vi.mocked(useLeaderboard).mockReturnValue({
      data: {
        myRank: 2,
        leaderboard: [
          {
            userId: "u1",
            rank: 1,
            nameMasked: "홍*동",
            totalPoints: 100,
            isCurrentUser: false,
          },
        ],
      },
      isLoading: false,
    } as never);
    vi.mocked(useAttendanceToday).mockReturnValue({
      data: { attended: true, checkinAt: "2026-02-28T08:10:00Z" },
      isLoading: false,
    } as never);
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
  });

  it("renders no-sites state when site is unavailable", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: null,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByText("auth.noSitesAvailable")).toBeInTheDocument();
    expect(screen.getByText("home.pleaseWait")).toBeInTheDocument();
  });

  it("renders dashboard links and cards", () => {
    render(<HomePage />);

    expect(screen.getByText("MIRAE")).toBeInTheDocument();
    expect(screen.getByText("DOSI")).toBeInTheDocument();

    // The link text might be combined or contain SVG, but we mock translation to return key
    // so we can test if it exists. But wait, we render it inside a string or inside text node.
    expect(screen.getByText(/home\.myPointsCount/)).toBeInTheDocument();

    // Wait, the links don't have aria-labels so getByRole("link", {name}) might match text content.
    // In our component, we have text inside CardContent.
    expect(
      screen.getByRole("link", { name: /home\.safetyReport/ }),
    ).toHaveAttribute("href", "/posts/new");
    expect(screen.getByRole("link", { name: /home\.notices/ })).toHaveAttribute(
      "href",
      "/announcements",
    );
    expect(
      screen.getByRole("link", { name: /home\.recommendation/ }),
    ).toHaveAttribute("href", "/votes");
    expect(
      screen.getByRole("link", { name: /home\.safetyWallet/ }),
    ).toHaveAttribute("href", "/points");
    expect(
      screen.getByRole("link", { name: /home\.safetyWallet/ }),
    ).toHaveAttribute("href", "/points");
  });

  it("uses fallback display name and zero points when data is missing", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: "site-1",
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });
    vi.mocked(usePoints).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);

    render(<HomePage />);

    expect(screen.getByText(/home\.greetingName/)).toBeInTheDocument();
    expect(screen.getByText(/home\.myPointsCount/)).toBeInTheDocument();
  });

  it("uses empty site id for points query when auth is not ready", () => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: "site-1",
      isAuthenticated: false,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<HomePage />);

    expect(usePoints).toHaveBeenCalledWith("");
  });
});
