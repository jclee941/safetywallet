import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EndpointsTable } from "../endpoints-table";

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
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

describe("EndpointsTable", () => {
  it("renders loading skeleton", () => {
    render(
      <EndpointsTable
        endpointMetrics={undefined}
        isLoading
        maxEndpointRequests={100}
      />,
    );

    expect(screen.getByText("엔드포인트별 요청")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders sorted rows and durations", () => {
    render(
      <EndpointsTable
        isLoading={false}
        maxEndpointRequests={100}
        endpointMetrics={{
          groupBy: "endpoint",
          from: "",
          to: "",
          rows: [
            {
              endpoint: "/slow",
              method: "POST",
              totalRequests: 50,
              totalErrors: 0,
              avgDurationMs: 1200,
              maxDurationMs: 1300,
              total2xx: 50,
              total4xx: 0,
              total5xx: 0,
            },
            {
              endpoint: "/fast",
              method: "GET",
              totalRequests: 90,
              totalErrors: 0,
              avgDurationMs: 120,
              maxDurationMs: 200,
              total2xx: 90,
              total4xx: 0,
              total5xx: 0,
            },
          ],
        }}
      />,
    );

    const methods = screen.getAllByText(/GET|POST/);
    expect(methods[0]).toHaveTextContent("GET");
    expect(screen.getByText("/fast")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
    expect(screen.getByText("1.20s")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <EndpointsTable
        endpointMetrics={{ groupBy: "endpoint", from: "", to: "", rows: [] }}
        isLoading={false}
        maxEndpointRequests={1}
      />,
    );

    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });
});
