import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DistributionTab } from "../distribution-tab";
import { usePointsHistory } from "@/hooks/use-rewards";

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    type?: string;
  }) => (
    <input
      type={type}
      value={value}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value } })
      }
    />
  ),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-rewards", () => ({
  usePointsHistory: vi.fn(),
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
  }) => (
    <div>
      <p>{emptyMessage}</p>
      {data.map((row) => (
        <div key={String(row.id)}>
          {columns.map((column) => (
            <div key={`${String(row.id)}-${column.key}`}>
              {column.render
                ? column.render(row)
                : String(row[column.key] ?? "")}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const mockUsePointsHistory = vi.mocked(usePointsHistory);

describe("DistributionTab", () => {
  beforeEach(() => {
    mockUsePointsHistory.mockReturnValue({
      isLoading: false,
      data: {
        entries: [
          {
            id: "h1",
            createdAt: "2026-03-15T00:00:00.000Z",
            amount: 120,
            reasonCode: "REWARD_MONTHLY",
            reasonText: "월간 포상 지급",
            member: { user: { nameMasked: "홍길동" } },
          },
          {
            id: "h2",
            createdAt: "2026-03-16T00:00:00.000Z",
            amount: -20,
            reasonCode: "AWARD_ADJ",
            reasonText: "",
            member: { user: { nameMasked: "임꺽정" } },
          },
          {
            id: "h3",
            createdAt: "2026-03-17T00:00:00.000Z",
            amount: 50,
            reasonCode: "OTHER",
            reasonText: "일반",
            member: { user: { nameMasked: "미포함" } },
          },
        ],
      },
    } as never);
  });

  it("filters reward-like entries and renders mapped columns", () => {
    render(<DistributionTab />);

    const monthInput = document.querySelector("input[type='month']");
    expect(monthInput).toBeInTheDocument();
    fireEvent.change(monthInput as HTMLInputElement, {
      target: { value: "2026-03" },
    });

    expect(screen.getByText("배분 기록")).toBeInTheDocument();
    expect(screen.getByText("+120P")).toBeInTheDocument();
    expect(screen.getByText("-20P")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("임꺽정")).toBeInTheDocument();
    expect(screen.getByText("지급")).toBeInTheDocument();
    expect(screen.getByText("차감")).toBeInTheDocument();
    expect(screen.queryByText("미포함")).not.toBeInTheDocument();
    expect(
      screen.getByText("선택한 월의 배분 기록이 없습니다"),
    ).toBeInTheDocument();
  });

  it("updates month filter and shows loading empty message", () => {
    mockUsePointsHistory.mockReturnValue({
      isLoading: true,
      data: { entries: [] },
    } as never);

    render(<DistributionTab />);

    const monthInput = document.querySelector("input[type='month']");
    expect(monthInput).toBeInTheDocument();
    fireEvent.change(monthInput as HTMLInputElement, {
      target: { value: "2026-04" },
    });
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});
