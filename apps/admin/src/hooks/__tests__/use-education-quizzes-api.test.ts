import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAdminQuizAttempts,
  useCreateQuiz,
  useCreateQuizQuestion,
  useDeleteQuiz,
  useDeleteQuizQuestion,
  useQuiz,
  useQuizzes,
  useUpdateQuiz,
  useUpdateQuizQuestion,
} from "@/hooks/use-education-quizzes-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig<TVariables> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const useMutationMock = vi.fn<(config: MutationConfig<unknown>) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig<unknown>) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-education-quizzes-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("builds quizzes list query params and enabled guard", async () => {
    apiFetchMock.mockResolvedValue({ quizzes: [] });
    useQuizzes({ status: "PUBLISHED", limit: 10, offset: 2 });
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "quizzes",
      "site-1",
      { status: "PUBLISHED", limit: 10, offset: 2 },
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/quizzes?siteId=site-1&status=PUBLISHED&limit=10&offset=2",
    );

    authState = { currentSiteId: null };
    useQuizzes();
    const noSiteConfig = useQueryMock.mock.calls[1][0];
    expect(noSiteConfig.enabled).toBe(false);
    await noSiteConfig.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/quizzes?");
  });

  it("builds quiz detail query and enabled guard", async () => {
    apiFetchMock.mockResolvedValue({ id: "quiz-1" });
    useQuiz("quiz-1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "quiz", "site-1", "quiz-1"]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/quizzes/quiz-1");

    useQuiz("");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("handles quiz CRUD question mutations and invalidations", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateQuiz();
    const createQuiz = useMutationMock.mock.calls[0][0] as MutationConfig<{
      title: string;
    }>;
    await createQuiz.mutationFn({ title: "quiz" });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/quizzes", {
      method: "POST",
      body: JSON.stringify({ title: "quiz" }),
    });
    createQuiz.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "quizzes"],
    });

    useCreateQuizQuestion();
    const createQuestion = useMutationMock.mock.calls[1][0] as MutationConfig<{
      quizId: string;
      data: { question: string };
    }>;
    await createQuestion.mutationFn({
      quizId: "q1",
      data: { question: "what" },
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/quizzes/q1/questions",
      {
        method: "POST",
        body: JSON.stringify({ question: "what" }),
      },
    );
    createQuestion.onSuccess?.();

    useUpdateQuizQuestion();
    const updateQuestion = useMutationMock.mock.calls[2][0] as MutationConfig<{
      quizId: string;
      questionId: string;
      data: { question: string };
    }>;
    await updateQuestion.mutationFn({
      quizId: "q1",
      questionId: "qq1",
      data: { question: "new" },
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/quizzes/q1/questions/qq1",
      {
        method: "PUT",
        body: JSON.stringify({ question: "new" }),
      },
    );
    updateQuestion.onSuccess?.();

    useDeleteQuizQuestion();
    const deleteQuestion = useMutationMock.mock.calls[3][0] as MutationConfig<{
      quizId: string;
      questionId: string;
    }>;
    await deleteQuestion.mutationFn({ quizId: "q1", questionId: "qq2" });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/quizzes/q1/questions/qq2",
      {
        method: "DELETE",
      },
    );
    deleteQuestion.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "quiz"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "quizzes"],
    });
  });

  it("handles update/delete quiz mutations and attempts query", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useUpdateQuiz();
    const updateQuiz = useMutationMock.mock.calls[0][0] as MutationConfig<{
      id: string;
      data: { title: string };
    }>;
    await updateQuiz.mutationFn({ id: "quiz-2", data: { title: "updated" } });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/quizzes/quiz-2", {
      method: "PATCH",
      body: JSON.stringify({ title: "updated" }),
    });
    updateQuiz.onSuccess?.();

    useDeleteQuiz();
    const deleteQuiz = useMutationMock.mock
      .calls[1][0] as MutationConfig<string>;
    await deleteQuiz.mutationFn("quiz-3");
    expect(apiFetchMock).toHaveBeenCalledWith("/education/quizzes/quiz-3", {
      method: "DELETE",
    });
    deleteQuiz.onSuccess?.();

    useAdminQuizAttempts("quiz-4", 2, 15);
    const attemptsQuery = useQueryMock.mock.calls[0][0];
    expect(attemptsQuery.queryKey).toEqual([
      "admin",
      "quiz-attempts",
      "site-1",
      "quiz-4",
      2,
      15,
    ]);
    expect(attemptsQuery.enabled).toBe(true);
    await attemptsQuery.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/admin/education/quiz-attempts?siteId=site-1&quizId=quiz-4&page=2&limit=15",
    );

    useAdminQuizAttempts(undefined, 1, 20);
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);

    authState = { currentSiteId: null };
    useAdminQuizAttempts("quiz-5", 1, 20);
    const noSiteAttempts = useQueryMock.mock.calls[2][0];
    expect(noSiteAttempts.enabled).toBe(false);
    await noSiteAttempts.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/admin/education/quiz-attempts?quizId=quiz-5&page=1&limit=20",
    );
  });
});
