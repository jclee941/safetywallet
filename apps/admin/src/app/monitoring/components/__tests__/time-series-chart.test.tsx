import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeSeriesChart } from "../time-series-chart";

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode; className?: string }) => (
    <h2>{children}</h2>
  ),
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" data-class={className} />
  ),
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-variant={variant} data-class={className}>
      {children}
    </span>
  ),
}));

describe("TimeSeriesChart", () => {
  it("renders loading skeleton", () => {
    render(
      <TimeSeriesChart timeMetrics={undefined} isLoading maxRequests={100} />,
    );

    expect(screen.getByText("요청 추이")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders rows with and without error badges", () => {
    render(
      <TimeSeriesChart
        isLoading={false}
        maxRequests={100}
        timeMetrics={{
          groupBy: "time",
          from: "",
          to: "",
          rows: [
            {
              bucket: "2026-01-01T10:00:00.000Z",
              endpoint: undefined,
              method: undefined,
              totalRequests: 50,
              totalErrors: 5,
              avgDurationMs: 0,
              maxDurationMs: 0,
              total2xx: 45,
              total4xx: 0,
              total5xx: 5,
            },
            {
              bucket: "2026-01-01T11:00:00.000Z",
              endpoint: undefined,
              method: undefined,
              totalRequests: 30,
              totalErrors: 0,
              avgDurationMs: 0,
              maxDurationMs: 0,
              total2xx: 30,
              total4xx: 0,
              total5xx: 0,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.getByText("요청")).toBeInTheDocument();
    expect(screen.getByText("에러")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <TimeSeriesChart
        timeMetrics={{ groupBy: "time", from: "", to: "", rows: [] }}
        isLoading={false}
        maxRequests={100}
      />,
    );

    expect(
      screen.getByText("해당 기간에 수집된 메트릭이 없습니다."),
    ).toBeInTheDocument();
  });
});
