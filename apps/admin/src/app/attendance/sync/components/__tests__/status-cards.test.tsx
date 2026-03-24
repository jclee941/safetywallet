import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusCards } from "../status-cards";

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
}));

describe("StatusCards", () => {
  const baseStatus = {
    fasStatus: "up",
    lastFullSync: "2026-03-01T00:00:00.000Z",
    userStats: {
      total: 1000,
      fasLinked: 750,
      missingPhone: 4,
      deleted: 0,
    },
    syncErrorCounts: {
      open: 2,
      resolved: 8,
      ignored: 1,
    },
    recentSyncLogs: [],
  };

  it("renders healthy badge and normalized healthy status message", () => {
    render(<StatusCards syncStatus={baseStatus} isHealthy />);

    expect(screen.getByText("정상")).toBeInTheDocument();
    expect(screen.getByText("연동 정상")).toBeInTheDocument();
    expect(screen.getByText("750")).toBeInTheDocument();
    expect(screen.getByText("/ 1,000")).toBeInTheDocument();
    expect(screen.getByText("미등록 전화번호 4건")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders fallback status labels for down and unknown values", () => {
    const { rerender } = render(
      <StatusCards
        syncStatus={{
          ...baseStatus,
          fasStatus: "down",
          lastFullSync: null,
          syncErrorCounts: { open: 0, resolved: 1, ignored: 2 },
        }}
        isHealthy={false}
      />,
    );

    expect(screen.getByText("연결 실패")).toBeInTheDocument();
    expect(screen.getByText("연동 장애 감지")).toBeInTheDocument();
    expect(screen.getByText("동기화 기록 없음")).toBeInTheDocument();
    expect(screen.getByText("해결 1 / 무시 2")).toBeInTheDocument();

    rerender(
      <StatusCards
        syncStatus={{ ...baseStatus, fasStatus: " custom_status " }}
        isHealthy={false}
      />,
    );

    expect(screen.getByText(/custom_status/)).toBeInTheDocument();
  });

  it("treats empty and numeric healthy status values correctly", () => {
    const { rerender } = render(
      <StatusCards syncStatus={{ ...baseStatus, fasStatus: "" }} isHealthy />,
    );
    expect(screen.getByText("Hyperdrive 연결 정상")).toBeInTheDocument();

    rerender(
      <StatusCards syncStatus={{ ...baseStatus, fasStatus: "0" }} isHealthy />,
    );
    expect(screen.getByText("연동 정상")).toBeInTheDocument();

    rerender(
      <StatusCards
        syncStatus={{ ...baseStatus, fasStatus: "1" }}
        isHealthy={false}
      />,
    );
    expect(screen.getByText("연동 장애 감지")).toBeInTheDocument();
  });
});
