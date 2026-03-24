import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApprovalsPage from "../page";

interface ApprovalListProps {
  status: "PENDING" | "HISTORY";
  selectable?: boolean;
}

interface ApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

let latestApprovalListProps: ApprovalListProps | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/approvals",
}));

vi.mock("@safetywallet/ui", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/approvals/approval-list", () => ({
  ApprovalList: (props: ApprovalListProps) => {
    latestApprovalListProps = props;
    return <div data-testid="approval-list">{props.status}</div>;
  },
}));

vi.mock("@/components/approvals/approval-dialog", () => ({
  ApprovalDialog: ({ isOpen, onClose }: ApprovalDialogProps) => (
    <div data-testid="approval-dialog">
      <span>{isOpen ? "open" : "closed"}</span>
      <button type="button" onClick={onClose}>
        close-dialog
      </button>
    </div>
  ),
}));

describe("ApprovalsPage", () => {
  it("renders page with pending tab as default", () => {
    render(<ApprovalsPage />);

    expect(screen.getByText("승인 관리")).toBeInTheDocument();
    expect(screen.getByTestId("approval-list")).toHaveTextContent("PENDING");
    expect(latestApprovalListProps).toEqual({
      status: "PENDING",
      selectable: true,
    });
  });

  it("switches to history tab", () => {
    render(<ApprovalsPage />);

    const pendingTab = screen.getByRole("button", { name: "대기 중" });
    const historyTab = screen.getByRole("button", { name: "처리 내역" });

    expect(pendingTab.className).toContain(
      "border-b-2 border-primary text-primary",
    );
    expect(historyTab.className).toContain("text-muted-foreground");

    fireEvent.click(historyTab);

    expect(screen.getByTestId("approval-list")).toHaveTextContent("HISTORY");
    expect(latestApprovalListProps).toEqual({
      status: "HISTORY",
      selectable: false,
    });

    expect(pendingTab.className).toContain("text-muted-foreground");
    expect(historyTab.className).toContain(
      "border-b-2 border-primary text-primary",
    );
  });

  it("opens and closes manual approval dialog", () => {
    render(<ApprovalsPage />);

    expect(screen.getByTestId("approval-dialog")).toHaveTextContent("closed");
    fireEvent.click(screen.getByRole("button", { name: /수동 승인 생성/ }));
    expect(screen.getByTestId("approval-dialog")).toHaveTextContent("open");

    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));
    expect(screen.getByTestId("approval-dialog")).toHaveTextContent("closed");
  });
});
