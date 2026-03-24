import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewStatus } from "@safetywallet/types";
import { describe, expect, it, vi } from "vitest";
import { ActionButtons } from "../action-buttons";

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
  };
});

vi.mock("lucide-react", () => ({
  Check: () => null,
  X: () => null,
  HelpCircle: () => null,
  AlertTriangle: () => null,
}));

describe("ActionButtons", () => {
  it("renders all actions including urgent when status allows", () => {
    const onApproveClick = vi.fn();
    const onRejectClick = vi.fn();
    const onInfoRequestClick = vi.fn();
    const onUrgentClick = vi.fn();

    render(
      <ActionButtons
        currentStatus={ReviewStatus.PENDING}
        isPending={false}
        onApproveClick={onApproveClick}
        onRejectClick={onRejectClick}
        onInfoRequestClick={onInfoRequestClick}
        onUrgentClick={onUrgentClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    fireEvent.click(screen.getByRole("button", { name: "추가 정보 요청" }));
    fireEvent.click(screen.getByRole("button", { name: "긴급 지정" }));

    expect(onApproveClick).toHaveBeenCalledTimes(1);
    expect(onRejectClick).toHaveBeenCalledTimes(1);
    expect(onInfoRequestClick).toHaveBeenCalledTimes(1);
    expect(onUrgentClick).toHaveBeenCalledTimes(1);
  });

  it("hides urgent button for disallowed statuses and disables buttons when pending", () => {
    render(
      <ActionButtons
        currentStatus={ReviewStatus.APPROVED}
        isPending={true}
        onApproveClick={vi.fn()}
        onRejectClick={vi.fn()}
        onInfoRequestClick={vi.fn()}
        onUrgentClick={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "긴급 지정" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "추가 정보 요청" }),
    ).toBeDisabled();
  });
});
