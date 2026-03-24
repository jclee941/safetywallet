import { fireEvent, render, screen } from "@testing-library/react";
import { RejectReason } from "@safetywallet/types";
import { describe, expect, it, vi } from "vitest";
import { RejectForm } from "../reject-form";

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

describe("RejectForm", () => {
  it("selects reasons, handles note, and triggers actions", () => {
    const onReasonSelect = vi.fn();
    const onNoteChange = vi.fn();
    const onReject = vi.fn();
    const onCancel = vi.fn();

    render(
      <RejectForm
        rejectReason={RejectReason.DUPLICATE}
        note="메모"
        isPending={false}
        onReasonSelect={onReasonSelect}
        onNoteChange={onNoteChange}
        onReject={onReject}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /중복 제보/ }));
    expect(onReasonSelect).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("추가 설명 (선택)"), {
      target: { value: "다시 확인" },
    });
    expect(onNoteChange).toHaveBeenCalledWith("다시 확인");

    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onReject).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables reject when reason missing or pending", () => {
    const { rerender } = render(
      <RejectForm
        rejectReason={null}
        note=""
        isPending={false}
        onReasonSelect={vi.fn()}
        onNoteChange={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();

    rerender(
      <RejectForm
        rejectReason={RejectReason.OTHER}
        note=""
        isPending={true}
        onReasonSelect={vi.fn()}
        onNoteChange={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "거절" })).toBeDisabled();
  });
});
