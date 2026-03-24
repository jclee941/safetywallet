import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidatesCard } from "../candidates-card";
import {
  useAddVoteCandidate,
  useDeleteVoteCandidate,
  useVoteCandidates,
} from "@/hooks/use-votes";
import { useMembers } from "@/hooks/use-api";

vi.mock("lucide-react", () => ({
  Plus: () => <span>plus-icon</span>,
  Search: () => <span>search-icon</span>,
  Trash2: () => <span>trash-icon</span>,
}));

const toastMock = vi.fn();
const addAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-votes", () => ({
  useVoteCandidates: vi.fn(),
  useAddVoteCandidate: vi.fn(),
  useDeleteVoteCandidate: vi.fn(),
}));

vi.mock("@/hooks/use-api", () => ({
  useMembers: vi.fn(),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableBody: ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  buttonVariants: () => "",
  useToast: () => ({ toast: toastMock }),
}));

const mockUseVoteCandidates = vi.mocked(useVoteCandidates);
const mockUseMembers = vi.mocked(useMembers);
const mockUseAddVoteCandidate = vi.mocked(useAddVoteCandidate);
const mockUseDeleteVoteCandidate = vi.mocked(useDeleteVoteCandidate);

describe("candidates card", () => {
  beforeEach(() => {
    toastMock.mockReset();
    addAsyncMock.mockReset();
    deleteAsyncMock.mockReset();

    mockUseVoteCandidates.mockReturnValue({
      data: [
        {
          id: "cand-1",
          source: "ADMIN",
          createdAt: "2026-02-01T00:00:00.000Z",
          user: { nameMasked: "홍길동", companyName: "안전건설" },
        },
      ],
      isLoading: false,
    } as never);
    mockUseMembers.mockReturnValue({
      data: [{ id: "m1", user: { id: "u1", name: "김철수" } }],
    } as never);
    mockUseAddVoteCandidate.mockReturnValue({
      mutateAsync: addAsyncMock,
    } as never);
    mockUseDeleteVoteCandidate.mockReturnValue({
      mutateAsync: deleteAsyncMock,
    } as never);
  });

  it("renders candidate table and add dialog trigger", () => {
    render(<CandidatesCard month="2026-02" />);
    expect(screen.getByText("후보자 관리")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /후보자 추가/ }),
    ).toBeInTheDocument();
  });

  it("adds candidate and clears search", async () => {
    render(<CandidatesCard month="2026-02" />);
    fireEvent.click(screen.getByRole("button", { name: /후보자 추가/ }));
    fireEvent.change(screen.getByPlaceholderText("이름 또는 전화번호 검색"), {
      target: { value: "김" },
    });
    fireEvent.click(screen.getByRole("button", { name: /선택/ }));

    await waitFor(() => {
      expect(addAsyncMock).toHaveBeenCalledWith({
        userId: "u1",
        month: "2026-02",
      });
    });
  });

  it("shows destructive toast when add fails", async () => {
    addAsyncMock.mockRejectedValueOnce(new Error("추가 실패"));
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: /후보자 추가/ }));
    fireEvent.click(screen.getByRole("button", { name: /선택/ }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("shows unknown error toast when add throws non-error", async () => {
    addAsyncMock.mockRejectedValueOnce("unexpected");
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: /후보자 추가/ }));
    fireEvent.click(screen.getByRole("button", { name: /선택/ }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "후보자 추가 실패",
          description: "알 수 없는 오류",
        }),
      );
    });
  });

  it("shows loading and empty states", () => {
    mockUseVoteCandidates.mockReturnValueOnce({
      data: [],
      isLoading: true,
    } as never);
    const { rerender } = render(<CandidatesCard month="2026-02" />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    mockUseVoteCandidates.mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as never);
    rerender(<CandidatesCard month="2026-02" />);
    expect(screen.getByText("등록된 후보자가 없습니다")).toBeInTheDocument();
  });

  it("shows no search results message", () => {
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: /후보자 추가/ }));
    fireEvent.change(screen.getByPlaceholderText("이름 또는 전화번호 검색"), {
      target: { value: "없는이름" },
    });

    expect(screen.getByText("검색 결과가 없습니다")).toBeInTheDocument();
  });

  it("deletes candidate successfully", async () => {
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: "trash-icon" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteAsyncMock).toHaveBeenCalledWith("cand-1");
    });
  });

  it("shows destructive toast when delete fails", async () => {
    deleteAsyncMock.mockRejectedValueOnce(new Error("삭제 실패"));
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: "trash-icon" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "후보자 삭제 실패",
          description: "삭제 실패",
        }),
      );
    });
  });

  it("shows unknown error toast when delete throws non-error", async () => {
    deleteAsyncMock.mockRejectedValueOnce("unexpected");
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: "trash-icon" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "후보자 삭제 실패",
          description: "알 수 없는 오류",
        }),
      );
    });
  });

  it("closes delete dialog when cancel is clicked", () => {
    render(<CandidatesCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: "trash-icon" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(deleteAsyncMock).not.toHaveBeenCalled();
  });
});
