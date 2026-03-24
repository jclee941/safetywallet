import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InfoRequestForm } from "../info-request-form";

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

describe("InfoRequestForm", () => {
  it("updates note and triggers actions", () => {
    const onNoteChange = vi.fn();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <InfoRequestForm
        note="요청"
        isPending={false}
        onNoteChange={onNoteChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("필요한 정보를 입력하세요"), {
      target: { value: "새 요청" },
    });
    expect(onNoteChange).toHaveBeenCalledWith("새 요청");

    fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables submit for blank note or pending state", () => {
    const { rerender } = render(
      <InfoRequestForm
        note="   "
        isPending={false}
        onNoteChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "요청 보내기" })).toBeDisabled();

    rerender(
      <InfoRequestForm
        note="내용"
        isPending={true}
        onNoteChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "요청 보내기" })).toBeDisabled();
  });
});
