import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewHistoryCard } from "../review-history-card";

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Badge: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

describe("ReviewHistoryCard", () => {
  it("renders empty state", () => {
    render(<ReviewHistoryCard reviews={[]} />);
    expect(screen.getByText("아직 검토 이력이 없습니다")).toBeInTheDocument();
  });

  it("renders review rows with optional fields", () => {
    render(
      <ReviewHistoryCard
        reviews={[
          {
            id: "r1",
            action: "APPROVE",
            createdAt: "2026-03-24T00:00:00.000Z",
            admin: { nameMasked: "관*자" },
            comment: "확인 완료",
            reasonCode: "POLICY_1",
          },
          {
            id: "r2",
            action: "CUSTOM_ACTION",
            createdAt: "2026-03-24T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("승인")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM_ACTION")).toBeInTheDocument();
    expect(screen.getByText("처리자: 관*자")).toBeInTheDocument();
    expect(screen.getByText("확인 완료")).toBeInTheDocument();
    expect(screen.getByText("사유: POLICY_1")).toBeInTheDocument();
  });
});
