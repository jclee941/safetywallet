import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuizTakePage from "@/app/education/quiz-take/page";
import {
  useMyQuizAttempts,
  useQuiz,
  useSubmitQuizAttempt,
} from "@/hooks/use-api";
import { setMockSearchParams, getMockRouter } from "@/__tests__/mocks";

const toastMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useQuiz: vi.fn(),
  useSubmitQuizAttempt: vi.fn(),
  useMyQuizAttempts: vi.fn(),
}));
vi.mock("@/hooks/use-education-api", () => ({}));
vi.mock("@/stores/auth", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/i18n/context", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@safetywallet/ui", async () => {
  const actual = await vi.importActual("@safetywallet/ui");
  return {
    ...actual,
    useToast: () => ({ toast: toastMock }),
  };
});

const mixedQuiz = {
  id: "q1",
  title: "안전 퀴즈",
  description: "복합 문제",
  maxAttempts: 3,
  timeLimitMinutes: 10,
  questions: [
    {
      id: "q-single",
      question: "단일 선택",
      questionType: "SINGLE_CHOICE",
      options: ["A", "B"],
      correctAnswer: 0,
      explanation: null,
      displayOrder: 1,
    },
    {
      id: "q-ox",
      question: "OX 선택",
      questionType: "OX",
      options: ["O", "X"],
      correctAnswer: 0,
      explanation: null,
      displayOrder: 2,
    },
    {
      id: "q-multi",
      question: "복수 선택",
      questionType: "MULTI_CHOICE",
      options: ["M1", "M2", "M3"],
      correctAnswer: [0, 2],
      explanation: null,
      displayOrder: 3,
    },
    {
      id: "q-short",
      question: "주관식",
      questionType: "SHORT_ANSWER",
      options: [],
      correctAnswer: "답",
      explanation: null,
      displayOrder: 4,
    },
    {
      id: "q-image",
      question: "이미지 문제",
      questionType: "IMAGE",
      options: '["I1","I2"]',
      correctAnswer: 1,
      explanation: null,
      displayOrder: 5,
      imageUrl: "https://example.com/missing.png",
    },
  ],
};

describe("app/education/quiz-take/page", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("renders loading state", () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useQuiz).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<QuizTakePage />);
    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("bottom-nav")).toBeInTheDocument();
  });

  it("renders loading state when attempts are still loading", () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useQuiz).mockReturnValue({
      data: mixedQuiz,
      isLoading: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: true,
    } as never);
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<QuizTakePage />);
    expect(screen.getByText("header")).toBeInTheDocument();
  });

  it("renders not found fallback", () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useQuiz).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
    expect(getMockRouter().back).toHaveBeenCalled();
  });

  it("submits quiz and shows result", async () => {
    setMockSearchParams({ id: "q1" });
    const mutate = vi.fn(
      (_payload: unknown, options: { onSuccess: (v: unknown) => void }) =>
        options.onSuccess({
          attempt: { score: 100, passed: true, answers: [0] },
        }),
    );
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q1",
        title: "안전 퀴즈",
        maxAttempts: 3,
        questions: [
          {
            id: "qq1",
            question: "정답은?",
            questionType: "SINGLE_CHOICE",
            options: ["1", "2"],
            correctAnswer: 0,
            explanation: null,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("education.quiz.status.pass"),
      ).toBeInTheDocument();
    });
  });

  it("requires all answers before submission", () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: mixedQuiz,
      isLoading: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "education.quiz.selectAllAnswers",
        variant: "destructive",
      }),
    );
  });

  it("handles all question types and failed submission with retake", async () => {
    setMockSearchParams({ id: "q1" });
    const mutate = vi.fn(
      (_payload: unknown, options: { onSuccess: (v: unknown) => void }) =>
        options.onSuccess({
          attempt: {
            score: 40,
            passed: false,
            answers: [0, 1, [0, 2], "직접 입력", 1],
          },
        }),
    );
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: mixedQuiz,
      isLoading: false,
    } as never);

    const { container } = render(<QuizTakePage />);

    fireEvent.error(screen.getByRole("img", { name: "문항 이미지 5" }));
    expect(screen.getByText("이미지를 불러올 수 없습니다")).toBeInTheDocument();

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "⭕ O" }));
    fireEvent.click(screen.getByText("M1"));
    fireEvent.click(screen.getByText("M3"));
    fireEvent.change(screen.getByPlaceholderText("정답을 입력해 주세요"), {
      target: { value: "직접 입력" },
    });
    fireEvent.click(screen.getByText("I2"));
    expect(screen.getByText("10education.minutes")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("education.quiz.status.fail"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("education.quiz.answersHeading"),
    ).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("M1, M3")).toBeInTheDocument();
    expect(screen.getByText("직접 입력")).toBeInTheDocument();
    expect(screen.getByText("I2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "education.retake" }));
    expect(
      container.textContent?.includes("education.quiz.submitButton"),
    ).toBeTruthy();
  });

  it("shows submission error toast and navigates back to list", async () => {
    setMockSearchParams({ id: "q1" });
    const mutate = vi.fn(
      (_payload: unknown, options: { onError: () => void }) =>
        options.onError(),
    );
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q1",
        title: "안전 퀴즈",
        maxAttempts: 1,
        questions: [
          {
            id: "qq1",
            question: "정답은?",
            questionType: "SINGLE_CHOICE",
            options: ["1", "2"],
            correctAnswer: 0,
            explanation: null,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "education.quiz.submitError",
          variant: "destructive",
        }),
      );
    });

    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [
        {
          id: "a1",
          score: 95,
          passed: true,
          totalQuestions: 1,
          correctCount: 1,
          createdAt: "2024-01-01",
          answers: [0],
        },
      ],
      isLoading: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.backToListButton" }),
    );
    expect(getMockRouter().push).toHaveBeenCalledWith("/education");
  });

  it("shows previous answers when revisiting a quiz", async () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q1",
        title: "안전 퀴즈",
        maxAttempts: 3,
        questions: [
          {
            id: "qq1",
            question: "정답은?",
            questionType: "SINGLE_CHOICE",
            options: ["사과", "배"],
            correctAnswer: 0,
            explanation: null,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [
        {
          id: "a1",
          score: 90,
          passed: true,
          totalQuestions: 1,
          correctCount: 1,
          createdAt: "2024-01-01",
          answers: [1],
        },
      ],
      isLoading: false,
    } as never);

    render(<QuizTakePage />);

    await waitFor(() => {
      expect(
        screen.getByText("education.quiz.answersHeading"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("education.quiz.status.pass")).toBeInTheDocument();
    expect(screen.getByText("배")).toBeInTheDocument();
  });

  it("toggles multi-choice off and shows unanswered validation", () => {
    setMockSearchParams({ id: "q1" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: mixedQuiz,
      isLoading: false,
    } as never);

    render(<QuizTakePage />);
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByRole("button", { name: "⭕ O" }));
    fireEvent.click(screen.getByText("M1"));
    fireEvent.click(screen.getByText("M1"));
    fireEvent.change(screen.getByPlaceholderText("정답을 입력해 주세요"), {
      target: { value: "직접 입력" },
    });
    fireEvent.click(screen.getByText("I2"));
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "education.quiz.selectAllAnswers",
        variant: "destructive",
      }),
    );
  });

  it("formats undefined options and invalid answers as no-answer in review", async () => {
    setMockSearchParams({ id: "q-format" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q-format",
        title: "포맷 퀴즈",
        maxAttempts: 1,
        questions: [
          {
            id: "qm1",
            question: "복수형",
            questionType: "MULTI_CHOICE",
            options: undefined,
            correctAnswer: [0],
            explanation: null,
            displayOrder: 1,
          },
          {
            id: "qs1",
            question: "단일형",
            questionType: "SINGLE_CHOICE",
            options: undefined,
            correctAnswer: 0,
            explanation: null,
            displayOrder: 2,
          },
        ],
      },
      isLoading: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [
        {
          id: "attempt-1",
          score: 10,
          passed: false,
          totalQuestions: 2,
          correctCount: 0,
          createdAt: "2026-01-01",
          answers: [[], "not-a-number"],
        },
      ],
      isLoading: false,
    } as never);

    render(<QuizTakePage />);

    await waitFor(() => {
      expect(
        screen.getByText("education.quiz.answersHeading"),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText("education.quiz.noAnswer").length).toBe(2);
  });

  it("submits OX selection when X is chosen", async () => {
    setMockSearchParams({ id: "q-ox" });
    const mutate = vi.fn();
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q-ox",
        title: "OX 퀴즈",
        maxAttempts: 1,
        questions: [
          {
            id: "qo1",
            question: "OX",
            questionType: "OX",
            options: ["O", "X"],
            correctAnswer: 1,
            explanation: null,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<QuizTakePage />);

    fireEvent.click(screen.getByRole("button", { name: "❌ X" }));
    fireEvent.click(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ answers: { qo1: 1 } }),
        expect.any(Object),
      );
    });
  });

  it("renders no-answer for undefined options and invalid review answer types", async () => {
    setMockSearchParams({ id: "q-branch-cover" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q-branch-cover",
        title: "분기 커버",
        maxAttempts: 1,
        questions: [
          {
            id: "qs-undef",
            question: "옵션 없음 단일",
            questionType: "SINGLE_CHOICE",
            options: undefined,
            correctAnswer: 0,
            explanation: null,
            displayOrder: 1,
          },
          {
            id: "qm-invalid",
            question: "복수형",
            questionType: "MULTI_CHOICE",
            options: ["M1", "M2"],
            correctAnswer: [0],
            explanation: null,
            displayOrder: 2,
          },
          {
            id: "qo-invalid",
            question: "OX",
            questionType: "OX",
            options: ["O", "X"],
            correctAnswer: 0,
            explanation: null,
            displayOrder: 3,
          },
        ],
      },
      isLoading: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [
        {
          id: "attempt-branch-cover",
          score: 0,
          passed: false,
          totalQuestions: 3,
          correctCount: 0,
          createdAt: "2026-01-01",
          answers: [0, "bad-multi", "bad-ox"],
        },
      ],
      isLoading: false,
    } as never);

    render(<QuizTakePage />);

    await waitFor(() => {
      expect(
        screen.getByText("education.quiz.answersHeading"),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText("education.quiz.noAnswer").length).toBe(3);
  });

  it("falls back to single-choice type and handles invalid options JSON", () => {
    setMockSearchParams({ id: "q-invalid-meta" });
    vi.mocked(useSubmitQuizAttempt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyQuizAttempts).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuiz).mockReturnValue({
      data: {
        id: "q-invalid-meta",
        title: "메타 오류 퀴즈",
        maxAttempts: 1,
        questions: [
          {
            id: "q-invalid-1",
            question: "잘못된 메타",
            questionType: "UNSUPPORTED",
            options: "{invalid-json",
            correctAnswer: 0,
            explanation: null,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<QuizTakePage />);

    expect(screen.getByText("잘못된 메타")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "education.quiz.submitButton" }),
    ).toBeInTheDocument();
  });
});
