import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UrgentConfirm } from "../urgent-confirm";

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock("lucide-react", () => ({
  AlertTriangle: () => null,
}));

describe("UrgentConfirm", () => {
  it("renders warning and triggers confirm/cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <UrgentConfirm
        isPending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByText("긴급 건으로 지정하시겠습니까?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "긴급 지정" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables confirm button while pending", () => {
    render(
      <UrgentConfirm isPending={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "긴급 지정" })).toBeDisabled();
  });
});
