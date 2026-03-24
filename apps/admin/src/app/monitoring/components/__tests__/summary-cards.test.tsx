import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummaryCards } from "../summary-cards";

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

describe("SummaryCards", () => {
  it("renders loading placeholders", () => {
    render(<SummaryCards summary={undefined} isLoading />);

    expect(screen.getAllByText("로딩 중...")).toHaveLength(4);
  });

  it("returns null when summary is not available", () => {
    const { container } = render(
      <SummaryCards summary={undefined} isLoading={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders summary metrics", () => {
    render(
      <SummaryCards
        isLoading={false}
        summary={{
          periodMinutes: 60,
          from: "2026-01-01",
          totalRequests: 1234,
          totalErrors: 12,
          errorRate: 12.3,
          avgDurationMs: 123,
          maxDurationMs: 1450,
          statusBreakdown: {
            "2xx": 1200,
            "4xx": 20,
            "5xx": 14,
          },
        }}
      />,
    );

    expect(screen.getByText("총 요청 수")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("12.3")).toBeInTheDocument();
    expect(screen.getByText("에러 12건")).toBeInTheDocument();
    expect(screen.getByText("123ms")).toBeInTheDocument();
    expect(screen.getByText("최대 1.45s")).toBeInTheDocument();
    expect(screen.getByText("2xx: 1200")).toBeInTheDocument();
    expect(screen.getByText("4xx: 20")).toBeInTheDocument();
    expect(screen.getByText("5xx: 14")).toBeInTheDocument();
  });
});
