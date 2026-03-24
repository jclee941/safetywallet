import { fireEvent, render, screen } from "@testing-library/react";
import { Category } from "@safetywallet/types";
import { describe, expect, it, vi } from "vitest";
import { PointsPanel } from "../points-panel";
import type { PointPolicy } from "@/hooks/use-points-api";

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
  };
});

vi.mock("lucide-react", () => ({
  Check: () => null,
  Coins: () => null,
  ChevronDown: () => null,
}));

const activePolicies: PointPolicy[] = [
  {
    id: "p1",
    siteId: "site-1",
    name: "정책1",
    defaultAmount: 11,
    minAmount: 5,
    maxAmount: 20,
    reasonCode: "RC1",
    description: "정책 설명",
    dailyLimit: null,
    monthlyLimit: null,
    isActive: true,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
  },
];

describe("PointsPanel", () => {
  it("renders default auto-calculation helper and action handlers", () => {
    const onPolicySelect = vi.fn();
    const onPointsChange = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <PointsPanel
        activePolicies={activePolicies}
        selectedPolicyId=""
        pointsToAward={15}
        reasonCode="POST_APPROVED"
        category={Category.HAZARD}
        riskLevel="HIGH"
        suggestedPoints={15}
        isPending={false}
        onPolicySelect={onPolicySelect}
        onPointsChange={onPointsChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/기본: HAZARD 10점/)).toBeInTheDocument();
    expect(screen.getByText(/\+ HIGH 위험도 5점/)).toBeInTheDocument();
    expect(screen.getByText(/= 15점/)).toBeInTheDocument();
    expect(screen.getByText("사유 코드:")).toBeInTheDocument();
    expect(screen.getByText("POST_APPROVED")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "p1" },
    });
    expect(onPolicySelect).toHaveBeenCalledWith("p1");

    fireEvent.change(screen.getByDisplayValue("15"), {
      target: { value: "7" },
    });
    expect(onPointsChange).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole("button", { name: "승인 (15점 지급)" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows selected policy details and disables confirm on pending/negative points", () => {
    const onPointsChange = vi.fn();

    render(
      <PointsPanel
        activePolicies={activePolicies}
        selectedPolicyId="p1"
        pointsToAward={-1}
        reasonCode="RC1"
        category={undefined}
        riskLevel={undefined}
        suggestedPoints={5}
        isPending={true}
        onPolicySelect={vi.fn()}
        onPointsChange={onPointsChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("정책 설명")).toBeInTheDocument();
    expect(screen.getByText("(범위: 5~20)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "승인 (-1점 지급)" }),
    ).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("-1"), {
      target: { value: "-30" },
    });
    expect(onPointsChange).toHaveBeenCalledWith(0);
  });
});
