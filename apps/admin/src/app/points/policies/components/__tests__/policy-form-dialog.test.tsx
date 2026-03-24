import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PolicyFormDialog } from "../policy-form-dialog";

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick}>
      {children}
    </button>
  ),
  Input: ({
    name,
    value,
    defaultValue,
    placeholder,
    disabled,
  }: {
    name?: string;
    value?: string | number | readonly string[];
    defaultValue?: string | number | readonly string[];
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={value !== undefined}
    />
  ),
  Switch: ({
    name,
    defaultChecked,
  }: {
    name?: string;
    defaultChecked?: boolean;
  }) => <input type="checkbox" name={name} defaultChecked={defaultChecked} />,
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));

describe("PolicyFormDialog", () => {
  it("renders create mode fields and submits", () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );

    render(
      <PolicyFormDialog
        mode="create"
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("새 포인트 정책 추가")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("SAFE_HELMET")).toBeInTheDocument();
    expect(screen.queryByText("활성화 상태")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders edit mode with existing policy and supports save", () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );

    render(
      <PolicyFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        editingPolicy={{
          id: "p1",
          siteId: "s1",
          reasonCode: "SAFE_HELMET",
          name: "안전모",
          description: "desc",
          defaultAmount: 10,
          minAmount: 1,
          maxAmount: 20,
          dailyLimit: 2,
          monthlyLimit: 10,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        }}
      />,
    );

    expect(screen.getByText("포인트 정책 수정")).toBeInTheDocument();
    expect(
      screen.getByText(
        "정책 상세 내용을 수정합니다. 코드는 수정할 수 없습니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("SAFE_HELMET")).toBeDisabled();
    expect(screen.getByText("활성화 상태")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not render form when editing policy is missing", () => {
    render(
      <PolicyFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        editingPolicy={null}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "저장" }),
    ).not.toBeInTheDocument();
  });
});
