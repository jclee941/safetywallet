import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorsTable } from "../errors-table";

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

describe("ErrorsTable", () => {
  it("renders loading skeleton", () => {
    render(<ErrorsTable topErrors={undefined} isLoading />);
    expect(screen.getByText("에러 상위 엔드포인트")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders rows with badges and optional 5xx count", () => {
    render(
      <ErrorsTable
        isLoading={false}
        topErrors={{
          from: "",
          to: "",
          rows: [
            {
              endpoint: "/reviews",
              method: "POST",
              totalRequests: 15,
              totalErrors: 2,
              errorRate: 12.345,
              total5xx: 2,
            },
            {
              endpoint: "/posts",
              method: "GET",
              totalRequests: 10,
              totalErrors: 1,
              errorRate: 4.2,
              total5xx: 0,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("/reviews")).toBeInTheDocument();
    expect(screen.getByText("15건")).toBeInTheDocument();
    expect(screen.getByText("12.3%")).toBeInTheDocument();
    expect(screen.getByText("5xx: 2")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
    expect(screen.queryByText("5xx: 0")).not.toBeInTheDocument();
  });

  it("renders empty state when no rows exist", () => {
    render(
      <ErrorsTable
        topErrors={{ from: "", to: "", rows: [] }}
        isLoading={false}
      />,
    );

    expect(screen.getByText("에러가 감지되지 않았습니다.")).toBeInTheDocument();
  });
});
