import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VoteCandidatesPage from "../page";
import { useDeleteVoteCandidate, useVoteCandidates } from "@/hooks/use-votes";

const deleteMock = vi.fn();
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-votes", () => ({
  useVoteCandidates: vi.fn(),
  useDeleteVoteCandidate: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  Trash2: () => <span>삭제 아이콘</span>,
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({ data, columns }: { data: any[]; columns: any[] }) => (
    <div>
      {data.map((row: any, i: number) => (
        <div key={row.id || i}>
          {columns.map((col: any) =>
            col.render ? <span key={col.key}>{col.render(row)}</span> : null,
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/votes/candidate-dialog", () => ({
  CandidateDialog: () => <div>candidate-dialog</div>,
}));

vi.mock("@safetywallet/ui", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  toast: toastMock,
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div>
        {children}
        <button type="button" onClick={() => onOpenChange?.(false)}>
          dialog-close
        </button>
      </div>
    ) : null,
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const mockUseVoteCandidates = vi.mocked(useVoteCandidates);
const mockUseDeleteVoteCandidate = vi.mocked(useDeleteVoteCandidate);

describe("vote candidates page", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    toastMock.mockReset();

    mockUseVoteCandidates.mockReturnValue({
      data: [
        {
          id: "cand-1",
          source: "ADMIN",
          createdAt: "2026-02-01T00:00:00.000Z",
          user: {
            nameMasked: "홍길동",
            companyName: "안전건설",
            tradeType: "전기",
          },
        },
      ],
      isLoading: false,
    } as never);

    mockUseDeleteVoteCandidate.mockReturnValue({
      mutate: deleteMock,
    } as never);
  });

  it("renders candidate management page", () => {
    render(<VoteCandidatesPage />);
    expect(screen.getByText("투표 후보 관리")).toBeInTheDocument();
    expect(screen.getByText("candidate-dialog")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseVoteCandidates.mockReturnValueOnce({
      data: [],
      isLoading: true,
    } as never);

    render(<VoteCandidatesPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("calls delete mutation and closes dialog on success", async () => {
    deleteMock.mockImplementation(
      (_id: string, options: { onSuccess?: () => void }) => {
        options.onSuccess?.();
      },
    );

    render(<VoteCandidatesPage />);

    fireEvent.click(screen.getByText("삭제 아이콘"));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "삭제되었습니다." }),
    );
  });

  it("shows destructive toast when delete fails", async () => {
    deleteMock.mockImplementation(
      (_id: string, options: { onError?: (error: Error) => void }) => {
        options.onError?.(new Error("권한 없음"));
      },
    );

    render(<VoteCandidatesPage />);

    fireEvent.click(screen.getByText("삭제 아이콘"));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "삭제 실패: 권한 없음",
        }),
      );
    });
  });

  it("updates candidates query with selected month", () => {
    render(<VoteCandidatesPage />);

    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}/), {
      target: { value: "2026-12" },
    });

    expect(mockUseVoteCandidates).toHaveBeenLastCalledWith("2026-12");
  });

  it("falls back to empty candidates list when hook data is undefined", () => {
    mockUseVoteCandidates.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
    } as never);

    render(<VoteCandidatesPage />);
    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
    expect(screen.getByText("투표 후보 관리")).toBeInTheDocument();
  });

  it("closes dialog via onOpenChange and prevents deletion", () => {
    render(<VoteCandidatesPage />);

    fireEvent.click(screen.getByText("삭제 아이콘"));
    fireEvent.click(screen.getByRole("button", { name: "dialog-close" }));

    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
