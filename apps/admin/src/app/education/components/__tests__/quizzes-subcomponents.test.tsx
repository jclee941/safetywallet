import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionForm } from "../quizzes-tab/question-form";
import { QuestionList } from "../quizzes-tab/question-list";
import { QuestionManagement } from "../quizzes-tab/question-management";
import { QuizList } from "../quizzes-tab/quiz-list";
import { QuizRegistration } from "../quizzes-tab/quiz-registration";
import {
  createMultiOption,
  getQuestionTypeLabel,
  parseMultiChoiceAnswers,
} from "../quizzes-tab/utils";
import type { QuestionFormState } from "../education-types";
import {
  useCreateQuiz,
  useCreateQuizQuestion,
  useDeleteQuizQuestion,
  useUpdateQuiz,
  useUpdateQuizQuestion,
} from "@/hooks/use-api";
import { useAdminQuizAttempts } from "@/hooks/use-education-quizzes-api";
import * as quizTypesRuntime from "../quizzes-tab/types";

const toastMock = vi.fn();
const createQuizAsyncMock = vi.fn();
const updateQuizAsyncMock = vi.fn();
const createQuestionAsyncMock = vi.fn();
const updateQuestionAsyncMock = vi.fn();
const deleteQuestionAsyncMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useCreateQuiz: vi.fn(),
  useUpdateQuiz: vi.fn(),
  useCreateQuizQuestion: vi.fn(),
  useUpdateQuizQuestion: vi.fn(),
  useDeleteQuizQuestion: vi.fn(),
}));

vi.mock("@/hooks/use-education-quizzes-api", () => ({
  useAdminQuizAttempts: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    columns,
    data,
    emptyMessage,
  }: {
    columns: Array<{
      key: string;
      header: string;
      render?: (item: Record<string, unknown>) => ReactNode;
    }>;
    data: Array<Record<string, unknown>>;
    emptyMessage?: string;
  }) => (
    <div>
      <p>{emptyMessage}</p>
      {data.map((item, rowIdx) => (
        <div key={String(item.id ?? rowIdx)}>
          {columns.map((column) => (
            <div key={`${String(item.id ?? rowIdx)}-${column.key}`}>
              {column.render
                ? column.render(item)
                : String(item[column.key] ?? "")}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open === false ? null : (
      <div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          dialog-close
        </button>
        {children}
      </div>
    ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open === false ? null : (
      <div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          alert-close
        </button>
        {children}
      </div>
    ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h3>{children}</h3>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
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
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  useToast: () => ({ toast: toastMock }),
}));

const mockUseCreateQuiz = vi.mocked(useCreateQuiz);
const mockUseUpdateQuiz = vi.mocked(useUpdateQuiz);
const mockUseCreateQuizQuestion = vi.mocked(useCreateQuizQuestion);
const mockUseUpdateQuizQuestion = vi.mocked(useUpdateQuizQuestion);
const mockUseDeleteQuizQuestion = vi.mocked(useDeleteQuizQuestion);
const mockUseAdminQuizAttempts = vi.mocked(useAdminQuizAttempts);

describe("quiz utils", () => {
  it("loads quiz types module at runtime", () => {
    expect(quizTypesRuntime).toBeDefined();
    expect(typeof quizTypesRuntime).toBe("object");
  });

  it("parses multi answers safely", () => {
    expect(parseMultiChoiceAnswers(undefined)).toEqual([]);
    expect(parseMultiChoiceAnswers("{}")).toEqual([]);
    expect(parseMultiChoiceAnswers("[0,1,2]")).toEqual([0, 1, 2]);
    expect(parseMultiChoiceAnswers('[0,-1,1.2,"a"]')).toEqual([0]);
    expect(parseMultiChoiceAnswers("bad-json")).toEqual([]);
  });

  it("creates multi option and resolves type labels", () => {
    const option = createMultiOption("선택");
    expect(option.id).toContain("multi-");
    expect(option.value).toBe("선택");

    expect(getQuestionTypeLabel("OX")).toBe("OX 퀴즈");
    expect(getQuestionTypeLabel("UNKNOWN")).toBe("단일 선택");
  });
});

describe("quiz registration", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createQuizAsyncMock.mockReset();
    updateQuizAsyncMock.mockReset();

    mockUseCreateQuiz.mockReturnValue({
      mutateAsync: createQuizAsyncMock,
      isPending: false,
    } as never);
    mockUseUpdateQuiz.mockReturnValue({
      mutateAsync: updateQuizAsyncMock,
      isPending: false,
    } as never);
  });

  it("creates quiz in new mode", async () => {
    render(<QuizRegistration />);

    fireEvent.change(screen.getByPlaceholderText("퀴즈 제목"), {
      target: { value: "신규 퀴즈" },
    });
    fireEvent.change(screen.getByPlaceholderText("설명"), {
      target: { value: "설명" },
    });
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 등록" }));

    await waitFor(() => {
      expect(createQuizAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: "site-1",
          title: "신규 퀴즈",
        }),
      );
    });
  });

  it("updates quiz in edit mode and supports cancel", async () => {
    const onCancelEdit = vi.fn();
    render(
      <QuizRegistration
        editingQuiz={{
          id: "q1",
          title: "기존 퀴즈",
          description: "old",
          status: "PUBLISHED",
          pointsReward: 20,
          timeLimitMinutes: 15,
          createdAt: "2026-01-01",
        }}
        onCancelEdit={onCancelEdit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("퀴즈 제목"), {
      target: { value: "수정 퀴즈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 수정" }));

    await waitFor(() => {
      expect(updateQuizAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "q1" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it("updates status and numeric fields in quiz form", () => {
    render(<QuizRegistration />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "ARCHIVED" } });

    fireEvent.change(screen.getByPlaceholderText("보상 포인트"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByPlaceholderText("제한 시간(분)"), {
      target: { value: "12" },
    });

    expect(screen.getByDisplayValue("50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("shows destructive toast on submit failure", async () => {
    createQuizAsyncMock.mockRejectedValueOnce(new Error("failed"));

    render(<QuizRegistration />);
    fireEvent.change(screen.getByPlaceholderText("퀴즈 제목"), {
      target: { value: "실패 퀴즈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 등록" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "failed",
        }),
      );
    });
  });
});

describe("question form and list", () => {
  it("does not remove multi option when there are only two", () => {
    const setQuestionForm = vi.fn();
    const setMultiOptions = vi.fn();
    const setMultiCorrectAnswers = vi.fn();

    render(
      <QuestionForm
        questionForm={{
          question: "질문",
          questionType: "MULTI_CHOICE",
          imageUrl: "",
          option1: "",
          option2: "",
          option3: "",
          option4: "",
          correctAnswer: "0",
          correctAnswerText: "",
          explanation: "",
        }}
        setQuestionForm={setQuestionForm}
        multiOptions={[createMultiOption("A"), createMultiOption("B")]}
        setMultiOptions={setMultiOptions}
        multiCorrectAnswers={[]}
        setMultiCorrectAnswers={setMultiCorrectAnswers}
        editingQuestionId={null}
        onSubmitQuestion={vi.fn()}
        resetQuestionForm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "제거" })[0]);
    expect(setMultiOptions).not.toHaveBeenCalled();
  });

  it("renders question form branches and callbacks", () => {
    const setQuestionForm = vi.fn();
    const setMultiOptions = vi.fn();
    const setMultiCorrectAnswers = vi.fn();
    const onSubmitQuestion = vi.fn();
    const resetQuestionForm = vi.fn();

    render(
      <QuestionForm
        questionForm={{
          question: "질문",
          questionType: "IMAGE",
          imageUrl: "",
          option1: "1",
          option2: "2",
          option3: "3",
          option4: "4",
          correctAnswer: "0",
          correctAnswerText: "",
          explanation: "",
        }}
        setQuestionForm={setQuestionForm}
        multiOptions={[
          createMultiOption("a"),
          createMultiOption("b"),
          createMultiOption("c"),
        ]}
        setMultiOptions={setMultiOptions}
        multiCorrectAnswers={[0]}
        setMultiCorrectAnswers={setMultiCorrectAnswers}
        editingQuestionId="qq1"
        onSubmitQuestion={onSubmitQuestion}
        resetQuestionForm={resetQuestionForm}
      />,
    );

    expect(
      screen.getByPlaceholderText("https://... 또는 /r2/..."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "수정 질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onSubmitQuestion).toHaveBeenCalled();
    expect(resetQuestionForm).toHaveBeenCalled();
    expect(setQuestionForm).toHaveBeenCalled();
  });

  it("renders multi-choice and empty list fallback", () => {
    const fillQuestionForm = vi.fn();
    const onDeleteQuestion = vi.fn();

    const multiQuestion = {
      id: "q1",
      question: "복수선택 문제",
      questionType: "MULTI_CHOICE",
      options: ["A", "B", "C"],
      correctAnswer: 0,
      correctAnswerText: "[0,2]",
      orderIndex: 0,
    };

    render(
      <>
        <QuestionList
          sortedQuizQuestions={[multiQuestion] as never}
          fillQuestionForm={fillQuestionForm}
          onDeleteQuestion={onDeleteQuestion}
        />
        <QuestionList
          sortedQuizQuestions={[]}
          fillQuestionForm={fillQuestionForm}
          onDeleteQuestion={onDeleteQuestion}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(fillQuestionForm).toHaveBeenCalled();
    expect(onDeleteQuestion).toHaveBeenCalledWith("q1");
    expect(screen.getByText("등록된 문항이 없습니다.")).toBeInTheDocument();
  });

  it("covers question form state transitions and multi-choice controls", () => {
    const onSubmitQuestion = vi.fn();
    const resetQuestionForm = vi.fn();

    function Harness() {
      const [questionForm, setQuestionForm] = useState<QuestionFormState>({
        question: "질문",
        questionType: "IMAGE" as const,
        imageUrl: "",
        option1: "",
        option2: "",
        option3: "",
        option4: "",
        correctAnswer: "0",
        correctAnswerText: "",
        explanation: "",
      });
      const [multiOptions, setMultiOptions] = useState([
        createMultiOption("A"),
        createMultiOption("B"),
      ]);
      const [multiCorrectAnswers, setMultiCorrectAnswers] = useState<number[]>(
        [],
      );

      return (
        <QuestionForm
          questionForm={questionForm}
          setQuestionForm={setQuestionForm}
          multiOptions={multiOptions}
          setMultiOptions={setMultiOptions}
          multiCorrectAnswers={multiCorrectAnswers}
          setMultiCorrectAnswers={setMultiCorrectAnswers}
          editingQuestionId={"edit-1"}
          onSubmitQuestion={onSubmitQuestion}
          resetQuestionForm={resetQuestionForm}
        />
      );
    }

    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText("해설"), {
      target: { value: "해설1" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://... 또는 /r2/..."), {
      target: { value: "https://img.test/q.png" },
    });
    expect(
      screen.getByDisplayValue("https://img.test/q.png"),
    ).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "1" } });

    fireEvent.change(selects[0], { target: { value: "MULTI_CHOICE" } });
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getAllByRole("button", { name: "제거" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "선택지 추가" }));
    fireEvent.click(screen.getAllByRole("button", { name: "제거" })[0]);

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "선택지 A" },
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "SHORT_ANSWER" },
    });
    fireEvent.change(screen.getByPlaceholderText("정답 텍스트"), {
      target: { value: "직접입력정답" },
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "OX" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "1" },
    });

    expect(screen.getByDisplayValue("해설1")).toBeInTheDocument();
  });

  it("updates multi-choice answer indices when toggling and removing options", () => {
    function MultiChoiceHarness() {
      const [questionForm, setQuestionForm] = useState<QuestionFormState>({
        question: "질문",
        questionType: "MULTI_CHOICE",
        imageUrl: "",
        option1: "",
        option2: "",
        option3: "",
        option4: "",
        correctAnswer: "0",
        correctAnswerText: "",
        explanation: "",
      });
      const [multiOptions, setMultiOptions] = useState([
        createMultiOption("A"),
        createMultiOption("B"),
        createMultiOption("C"),
      ]);
      const [multiCorrectAnswers, setMultiCorrectAnswers] = useState<number[]>([
        2,
      ]);

      return (
        <QuestionForm
          questionForm={questionForm}
          setQuestionForm={setQuestionForm}
          multiOptions={multiOptions}
          setMultiOptions={setMultiOptions}
          multiCorrectAnswers={multiCorrectAnswers}
          setMultiCorrectAnswers={setMultiCorrectAnswers}
          editingQuestionId={null}
          onSubmitQuestion={vi.fn()}
          resetQuestionForm={vi.fn()}
        />
      );
    }

    render(<MultiChoiceHarness />);

    const beforeToggle = screen.getAllByRole("checkbox");
    fireEvent.click(beforeToggle[2]);
    expect(beforeToggle[2]).not.toBeChecked();
    fireEvent.click(beforeToggle[2]);
    expect(beforeToggle[2]).toBeChecked();

    const removeButtons = screen.getAllByRole("button", { name: "제거" });
    fireEvent.click(removeButtons[0]);

    const afterRemove = screen.getAllByRole("checkbox");
    expect(afterRemove).toHaveLength(2);
    expect(afterRemove[1]).toBeChecked();
  });
});

describe("question management and quiz list", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createQuestionAsyncMock.mockReset();
    updateQuestionAsyncMock.mockReset();
    deleteQuestionAsyncMock.mockReset();

    mockUseCreateQuizQuestion.mockReturnValue({
      mutateAsync: createQuestionAsyncMock,
    } as never);
    mockUseUpdateQuizQuestion.mockReturnValue({
      mutateAsync: updateQuestionAsyncMock,
    } as never);
    mockUseDeleteQuizQuestion.mockReturnValue({
      mutateAsync: deleteQuestionAsyncMock,
    } as never);

    mockUseAdminQuizAttempts.mockReturnValue({
      data: {
        items: [
          {
            id: "a1",
            userName: "홍길동",
            score: 80,
            passed: true,
            completedAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    } as never);
  });

  it("validates and creates question", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "새 문항" },
    });

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });

    fireEvent.change(screen.getByPlaceholderText("선택지 1"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 2"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(createQuestionAsyncMock).toHaveBeenCalled();
    });
  });

  it("fills, updates, and deletes question", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{
          title: "안전",
          questions: [
            {
              id: "qq1",
              quizId: "quiz-1",
              question: "기존 문항",
              questionType: "SHORT_ANSWER",
              imageUrl: null,
              options: [],
              correctAnswer: 0,
              correctAnswerText: "답",
              explanation: "해설",
              orderIndex: 1,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "문항 수정" }));

    await waitFor(() => {
      expect(updateQuestionAsyncMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(deleteQuestionAsyncMock).toHaveBeenCalledWith({
        quizId: "quiz-1",
        questionId: "qq1",
      });
    });
  });

  it("handles create/update/delete failures and delete reset branch", async () => {
    createQuestionAsyncMock.mockRejectedValueOnce(new Error("create fail"));
    updateQuestionAsyncMock.mockRejectedValueOnce(new Error("update fail"));
    deleteQuestionAsyncMock.mockRejectedValueOnce(new Error("delete fail"));

    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{
          title: "안전",
          questions: [
            {
              id: "qq2",
              quizId: "quiz-1",
              question: "기존 문항",
              questionType: "SINGLE_CHOICE",
              imageUrl: null,
              options: ["A", "B"],
              correctAnswer: 0,
              correctAnswerText: null,
              explanation: null,
              orderIndex: 1,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "실패 문항" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 1"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 2"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "create fail",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "문항 수정" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "update fail",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "delete fail",
        }),
      );
    });

    deleteQuestionAsyncMock.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(deleteQuestionAsyncMock).toHaveBeenCalledWith({
        quizId: "quiz-1",
        questionId: "qq2",
      });
    });
    expect(
      screen.queryByRole("button", { name: "취소" }),
    ).not.toBeInTheDocument();
  });

  it("validates image and short-answer question requirements", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "이미지 문항" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "IMAGE" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 1"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 2"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "이미지 URL을 입력해 주세요." }),
      );
    });

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "SHORT_ANSWER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "정답 텍스트를 입력해 주세요.",
        }),
      );
    });
  });

  it("validates multi-choice out-of-range answers", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "복수선택 문항" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "MULTI_CHOICE" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "A" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B" },
    });

    fireEvent.click(screen.getByRole("button", { name: "선택지 추가" }));
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[2], {
      target: { value: "C" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[2], {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "정답 선택이 선택지 범위를 벗어났습니다.",
        }),
      );
    });
  });

  it("validates multi-choice question when no correct answers are selected", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "복수선택 미선택" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "MULTI_CHOICE" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "A" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B" },
    });

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "복수 선택 문항의 정답을 1개 이상 선택해 주세요.",
        }),
      );
      expect(createQuestionAsyncMock).not.toHaveBeenCalled();
    });
  });

  it("validates multi-choice question when option count is less than two", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "복수선택 선택지 부족" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "MULTI_CHOICE" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "A" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "복수 선택 문항은 선택지가 최소 2개 필요합니다.",
        }),
      );
    });
  });

  it("creates a valid multi-choice question", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "복수선택 성공" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "MULTI_CHOICE" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "A" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(createQuestionAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          quizId: "quiz-1",
          data: expect.objectContaining({
            questionType: "MULTI_CHOICE",
            options: ["A", "B"],
            correctAnswer: 0,
            correctAnswerText: "[0]",
          }),
        }),
      );
    });
  });

  it("creates multi-choice with sorted selected answers", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "복수선택 정렬" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "MULTI_CHOICE" },
    });

    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[0], {
      target: { value: "A" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "선택지 추가" }));
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[2], {
      target: { value: "C" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(createQuestionAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            correctAnswer: 0,
            correctAnswerText: "[0,2]",
          }),
        }),
      );
    });
  });

  it("validates single-choice answer index", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "단일선택 검증" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 1"), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByPlaceholderText("선택지 2"), {
      target: { value: "B" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "정답을 올바르게 선택해 주세요.",
        }),
      );
    });
  });

  it("creates OX question with valid answer", async () => {
    render(
      <QuestionManagement
        expandedQuizId="quiz-1"
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "OX 성공" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "OX" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(createQuestionAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionType: "OX",
            options: ["O", "X"],
            correctAnswer: 1,
          }),
        }),
      );
    });
  });

  it("returns early when quiz id is missing", async () => {
    render(
      <QuestionManagement
        expandedQuizId=""
        typedQuizDetail={{ title: "안전", questions: [] }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("문항"), {
      target: { value: "문항" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));

    await waitFor(() => {
      expect(createQuestionAsyncMock).not.toHaveBeenCalled();
      expect(updateQuestionAsyncMock).not.toHaveBeenCalled();
    });
  });

  it("renders quiz list branches and actions", () => {
    const onToggleExpand = vi.fn();
    const onEditQuiz = vi.fn();
    const onDeleteQuiz = vi.fn();

    render(
      <>
        <QuizList
          isLoading
          quizzes={[]}
          expandedQuizId={null}
          onToggleExpand={onToggleExpand}
          onEditQuiz={onEditQuiz}
          onDeleteQuiz={onDeleteQuiz}
        />
        <QuizList
          isLoading={false}
          quizzes={[
            {
              id: "q1",
              title: "퀴즈1",
              status: "DRAFT",
              createdAt: "2026-01-01",
              questionCount: 1,
              attemptCount: 1,
              timeLimitMinutes: 5,
            },
          ]}
          expandedQuizId={null}
          onToggleExpand={onToggleExpand}
          onEditQuiz={onEditQuiz}
          onDeleteQuiz={onDeleteQuiz}
        />
      </>,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "문항 관리" }));
    const unnamedButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(unnamedButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "1회" }));
    fireEvent.click(screen.getByRole("button", { name: "dialog-close" }));

    expect(onToggleExpand).toHaveBeenCalledWith("q1");
    expect(onDeleteQuiz).toHaveBeenCalledWith("q1");
  });

  it("renders zero-count branches and collapses expanded quiz", () => {
    const onToggleExpand = vi.fn();

    render(
      <QuizList
        isLoading={false}
        quizzes={[
          {
            id: "q1",
            title: "퀴즈1",
            status: "DRAFT",
            createdAt: "2026-01-01",
            questionCount: undefined,
            attemptCount: undefined,
            timeLimitMinutes: null,
          },
        ]}
        expandedQuizId="q1"
        onToggleExpand={onToggleExpand}
        onEditQuiz={vi.fn()}
        onDeleteQuiz={vi.fn()}
      />,
    );

    expect(screen.getByText("0개")).toBeInTheDocument();
    expect(screen.getByText("0회")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(onToggleExpand).toHaveBeenCalledWith(null);
  });
});
