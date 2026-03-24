import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportTab } from "../export-tab";
import { useMonthlyRankings, usePointsHistory } from "@/hooks/use-rewards";

const createObjectUrlMock = vi.fn(() => "blob://csv");
const revokeObjectUrlMock = vi.fn();
const clickMock = vi.fn();
let selectedType = "rankings";
let currentSiteId: string | null = "site-1";

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <div>
      <p>selected:{value}</p>
      <button
        type="button"
        onClick={() => {
          selectedType = selectedType === "rankings" ? "history" : "rankings";
          onValueChange?.(selectedType);
        }}
      >
        change-type
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode; value: string }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => <span>value</span>,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => string | null,
  ) => selector({ currentSiteId }),
}));

vi.mock("@/hooks/use-rewards", () => ({
  useMonthlyRankings: vi.fn(),
  usePointsHistory: vi.fn(),
}));

const mockUseMonthlyRankings = vi.mocked(useMonthlyRankings);
const mockUsePointsHistory = vi.mocked(usePointsHistory);

describe("ExportTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    selectedType = "rankings";
    currentSiteId = "site-1";
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    clickMock.mockClear();

    mockUseMonthlyRankings.mockReturnValue({
      data: {
        leaderboard: [{ rank: 1, nameMasked: "홍길동", totalPoints: 120 }],
      },
    } as never);
    mockUsePointsHistory.mockReturnValue({
      data: {
        entries: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            amount: 30,
            reason: "포상",
            member: { user: { nameMasked: "임꺽정" } },
          },
        ],
      },
    } as never);

    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName.toLowerCase() === "a") {
          const anchor = originalCreateElement("a") as HTMLAnchorElement;
          anchor.click = clickMock;
          return anchor;
        }
        return originalCreateElement(tagName);
      },
    );
  });

  it("exports rankings CSV", () => {
    render(<ExportTab />);

    expect(screen.getByText("내보내기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "CSV 다운로드" }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob://csv");
  });

  it("exports history CSV after type change", () => {
    render(<ExportTab />);

    fireEvent.click(screen.getByRole("button", { name: "change-type" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV 다운로드" }));

    expect(screen.getByText("selected:history")).toBeInTheDocument();
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  it("handles null siteId and missing rankings/history data safely", () => {
    currentSiteId = null;
    mockUseMonthlyRankings.mockReturnValue({ data: undefined } as never);
    mockUsePointsHistory.mockReturnValue({ data: undefined } as never);

    render(<ExportTab />);

    fireEvent.click(screen.getByRole("button", { name: "CSV 다운로드" }));
    expect(mockUseMonthlyRankings).toHaveBeenCalledWith(undefined);
    expect(mockUsePointsHistory).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: undefined }),
    );
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
  });

  it("handles nullish history reason when exporting history", () => {
    mockUsePointsHistory.mockReturnValue({
      data: {
        entries: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            amount: 10,
            reason: null,
            member: { user: { nameMasked: "이몽룡" } },
          },
        ],
      },
    } as never);

    render(<ExportTab />);

    fireEvent.click(screen.getByRole("button", { name: "change-type" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV 다운로드" }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
  });
});
