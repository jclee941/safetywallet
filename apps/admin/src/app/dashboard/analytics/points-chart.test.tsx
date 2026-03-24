import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PointsChart } from "./points-chart";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({
    children,
    data,
  }: {
    children: ReactNode;
    data?: Array<{ name: string }>;
  }) => (
    <div>
      {data?.map((item) => (
        <span key={item.name}>{item.name}</span>
      ))}
      {children}
    </div>
  ),
  Cell: () => null,
  Tooltip: ({ formatter }: { formatter?: (value: unknown) => string }) => (
    <div>
      <span data-testid="tooltip-number">{formatter?.(1234)}</span>
      <span data-testid="tooltip-null">{formatter?.(null)}</span>
    </div>
  ),
  Legend: () => null,
}));

describe("PointsChart", () => {
  it("renders chart title and description", () => {
    render(
      <PointsChart
        data={[
          { reasonCode: "POST_APPROVED", totalAmount: 300, count: 3 },
          { reasonCode: "UNKNOWN", totalAmount: 100, count: 1 },
        ]}
      />,
    );

    expect(screen.getByText("포인트 사유 분포")).toBeInTheDocument();
    expect(
      screen.getByText("선택 기간의 reasonCode 별 지급/회수 합계"),
    ).toBeInTheDocument();
  });

  it("uses label fallback, sorts data, and covers tooltip formatter branches", () => {
    render(
      <PointsChart
        data={[
          { reasonCode: "UNKNOWN", totalAmount: 200, count: 2 },
          { reasonCode: "ATTENDANCE_REWARD", totalAmount: 100, count: 1 },
        ]}
      />,
    );

    const labels = screen
      .getAllByText(/UNKNOWN|출근 보상/)
      .map((el) => el.textContent);
    expect(labels[0]).toBe("UNKNOWN");
    expect(labels[1]).toBe("출근 보상");
    expect(screen.getByTestId("tooltip-number")).toHaveTextContent("1,234");
    expect(screen.getByTestId("tooltip-null")).toHaveTextContent("");
  });
});
