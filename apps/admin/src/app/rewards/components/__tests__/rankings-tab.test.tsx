import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RankingsTab } from "../rankings-tab";
import { useMonthlyRankings } from "@/hooks/use-rewards";

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-rewards", () => ({
  useMonthlyRankings: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    data,
    columns,
    emptyMessage,
  }: {
    data: Array<{
      nameMasked: string;
      totalPoints: number;
      isCurrentUser: boolean;
    }>;
    columns: Array<{
      key: string;
      render?: (row: {
        nameMasked: string;
        totalPoints: number;
        isCurrentUser: boolean;
      }) => ReactNode;
    }>;
    emptyMessage?: string;
  }) => {
    if (data.length === 0) {
      return <div>{emptyMessage}</div>;
    }

    return (
      <div>
        {data.map((row, idx) => (
          <div key={`${row.nameMasked}-${idx}`}>
            <span>{row.nameMasked}</span>
            {columns
              .filter((column) => column.render)
              .map((column) => (
                <div key={column.key}>{column.render?.(row)}</div>
              ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const mockUseMonthlyRankings = vi.mocked(useMonthlyRankings);

describe("rankings tab", () => {
  it("renders loading state", () => {
    mockUseMonthlyRankings.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as never);
    render(<RankingsTab />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders leaderboard with current and non-current users", () => {
    mockUseMonthlyRankings.mockReturnValueOnce({
      data: {
        leaderboard: [
          {
            rank: 1,
            nameMasked: "홍길동",
            totalPoints: 1000,
            isCurrentUser: true,
          },
          {
            rank: 2,
            nameMasked: "김철수",
            totalPoints: 500,
            isCurrentUser: false,
          },
        ],
      },
      isLoading: false,
    } as never);
    render(<RankingsTab />);
    expect(screen.getByText(/월간 순위/)).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("1,000P")).toBeInTheDocument();
    expect(screen.getByText("나")).toBeInTheDocument();
    expect(screen.getByText("김철수")).toBeInTheDocument();
    expect(screen.getByText("500P")).toBeInTheDocument();
  });

  it("renders empty message when leaderboard data is missing", () => {
    mockUseMonthlyRankings.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
    } as never);

    render(<RankingsTab />);

    expect(screen.getByText("순위 데이터가 없습니다.")).toBeInTheDocument();
  });
});
