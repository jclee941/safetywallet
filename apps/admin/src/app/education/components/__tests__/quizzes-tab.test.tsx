import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuizzesTab } from "../quizzes-tab";
import {
  useCreateQuiz,
  useCreateQuizQuestion,
  useDeleteQuiz,
  useDeleteQuizQuestion,
  useQuiz,
  useQuizzes,
  useUpdateQuiz,
  useUpdateQuizQuestion,
} from "@/hooks/use-api";

const toastMock = vi.fn();
const createQuizAsyncMock = vi.fn();
const createQuestionAsyncMock = vi.fn();
const updateQuestionAsyncMock = vi.fn();
const deleteQuestionAsyncMock = vi.fn();
const deleteQuizAsyncMock = vi.fn();
const updateQuizAsyncMock = vi.fn();

const { mockUseAdminQuizAttempts } = vi.hoisted(() => ({
  mockUseAdminQuizAttempts: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useCreateQuiz: vi.fn(),
  useCreateQuizQuestion: vi.fn(),
  useDeleteQuiz: vi.fn(),
  useDeleteQuizQuestion: vi.fn(),
  useQuiz: vi.fn(),
  useQuizzes: vi.fn(),
  useUpdateQuiz: vi.fn(),
  useUpdateQuizQuestion: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  AlertDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
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
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
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
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/use-education-quizzes-api", () => ({
  useAdminQuizAttempts: mockUseAdminQuizAttempts,
}));

const mockUseQuizzes = vi.mocked(useQuizzes);
const mockUseQuiz = vi.mocked(useQuiz);
const mockUseCreateQuiz = vi.mocked(useCreateQuiz);
const mockUseDeleteQuiz = vi.mocked(useDeleteQuiz);
const mockUseUpdateQuiz = vi.mocked(useUpdateQuiz);
const mockUseCreateQuizQuestion = vi.mocked(useCreateQuizQuestion);
const mockUseUpdateQuizQuestion = vi.mocked(useUpdateQuizQuestion);
const mockUseDeleteQuizQuestion = vi.mocked(useDeleteQuizQuestion);

describe("quizzes tab", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createQuizAsyncMock.mockReset();
    createQuestionAsyncMock.mockReset();
    updateQuestionAsyncMock.mockReset();
    deleteQuestionAsyncMock.mockReset();
    deleteQuizAsyncMock.mockReset();
    updateQuizAsyncMock.mockReset();

    mockUseQuizzes.mockReturnValue({
      data: {
        quizzes: [
          {
            id: "q1",
            title: "안전 퀴즈",
            status: "DRAFT",
            timeLimitMinutes: 10,
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    } as never);
    mockUseQuiz.mockReturnValue({
      data: {
        title: "안전 퀴즈",
        questions: [],
      },
    } as never);
    mockUseCreateQuiz.mockReturnValue({
      mutateAsync: createQuizAsyncMock,
      isPending: false,
    } as never);
    mockUseCreateQuizQuestion.mockReturnValue({
      mutateAsync: createQuestionAsyncMock,
    } as never);
    mockUseUpdateQuizQuestion.mockReturnValue({
      mutateAsync: updateQuestionAsyncMock,
    } as never);
    mockUseDeleteQuizQuestion.mockReturnValue({
      mutateAsync: deleteQuestionAsyncMock,
    } as never);
    mockUseDeleteQuiz.mockReturnValue({
      mutateAsync: deleteQuizAsyncMock,
      isPending: false,
    } as never);
    mockUseUpdateQuiz.mockReturnValue({
      mutateAsync: updateQuizAsyncMock,
      isPending: false,
    } as never);
    mockUseAdminQuizAttempts.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, total: 0, limit: 20, totalPages: 0 },
      },
      isLoading: false,
    } as never);
  });

  it("creates quiz and shows quiz list", async () => {
    render(<QuizzesTab />);
    expect(screen.getByText("안전 퀴즈")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /퀴즈 등록/ }));

    fireEvent.change(screen.getByPlaceholderText("퀴즈 제목"), {
      target: { value: "신규 퀴즈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 등록" }));

    await waitFor(() => {
      expect(createQuizAsyncMock).toHaveBeenCalled();
    });
  });

  it("validates question options and shows error toast", async () => {
    render(<QuizzesTab />);
    fireEvent.click(screen.getByRole("button", { name: "문항 관리" }));
    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "문항1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
    expect(createQuestionAsyncMock).not.toHaveBeenCalled();
  });

  it("edits quiz", async () => {
    render(<QuizzesTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[0]);
    fireEvent.change(screen.getByPlaceholderText("퀴즈 제목"), {
      target: { value: "수정 퀴즈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 수정" }));

    await waitFor(() => {
      expect(updateQuizAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "q1" }),
      );
    });
  });

  it("toggles quiz registration form", () => {
    render(<QuizzesTab />);

    fireEvent.click(screen.getByRole("button", { name: /퀴즈 등록/ }));
    expect(screen.getAllByText("퀴즈 등록").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(
      screen.queryByRole("button", { name: "접기" }),
    ).not.toBeInTheDocument();
  });

  it("clears editing state when collapsing the form", () => {
    render(<QuizzesTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[0]);
    expect(
      screen.getByRole("button", { name: "퀴즈 수정" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 등록" }));

    expect(
      screen.getByRole("button", { name: "퀴즈 등록" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "퀴즈 수정" }),
    ).not.toBeInTheDocument();
  });

  it("deletes quiz successfully and clears expanded question panel", async () => {
    deleteQuizAsyncMock.mockResolvedValueOnce(undefined);

    render(<QuizzesTab />);

    fireEvent.click(screen.getByRole("button", { name: "문항 관리" }));
    expect(screen.getByText(/문항 관리 - 안전 퀴즈/)).toBeInTheDocument();

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[1]);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteQuizAsyncMock).toHaveBeenCalledWith("q1");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "퀴즈가 삭제되었습니다." }),
      );
      expect(
        screen.queryByText(/문항 관리 - 안전 퀴즈/),
      ).not.toBeInTheDocument();
    });
  });

  it("clears current edit target when deleting the same quiz", async () => {
    deleteQuizAsyncMock.mockResolvedValueOnce(undefined);

    render(<QuizzesTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[0]);
    expect(
      screen.getByRole("button", { name: "퀴즈 수정" }),
    ).toBeInTheDocument();

    fireEvent.click(iconButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteQuizAsyncMock).toHaveBeenCalledWith("q1");
      expect(
        screen.queryByRole("button", { name: "퀴즈 수정" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows destructive toast when quiz delete fails", async () => {
    deleteQuizAsyncMock.mockRejectedValueOnce(new Error("delete failed"));

    render(<QuizzesTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[1]);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "퀴즈 삭제에 실패했습니다.",
        }),
      );
    });
  });
});
