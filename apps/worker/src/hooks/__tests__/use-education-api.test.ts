import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useAttendTbm,
  useEducationCompletionStatus,
  useEducationContent,
  useEducationContents,
  useMyQuizAttempts,
  useQuiz,
  useQuizzes,
  useSubmitEducationCompletion,
  useSubmitQuizAttempt,
  useTbmRecords,
} from "@/hooks/use-education-api";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("use-education-api", () => {
  it("fetches contents and content detail with enabled guards", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { contents: [{ id: "c1" }] } })
      .mockResolvedValueOnce({ data: { id: "c1", title: "교육" } });
    const { wrapper } = createWrapper();

    renderHook(() => useEducationContents(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    const list = renderHook(() => useEducationContents("site-1"), { wrapper });
    const detail = renderHook(() => useEducationContent("c1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/education/contents?siteId=site-1",
      );
      expect(apiFetch).toHaveBeenCalledWith("/education/contents/c1");
      expect(list.result.current.data).toEqual([{ id: "c1" }]);
      expect(detail.result.current.data).toEqual({ id: "c1", title: "교육" });
    });
  });

  it("fetches quizzes, quiz detail, and my attempts with enabled guards", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { quizzes: [{ id: "q1" }] } })
      .mockResolvedValueOnce({ data: { id: "q1", questions: [] } })
      .mockResolvedValueOnce({ data: { attempts: [{ id: "a1" }] } });
    const { wrapper } = createWrapper();

    renderHook(() => useQuizzes(""), { wrapper });
    renderHook(() => useQuiz(""), { wrapper });
    renderHook(() => useMyQuizAttempts(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    const quizzes = renderHook(() => useQuizzes("site-2"), { wrapper });
    const quiz = renderHook(() => useQuiz("q1"), { wrapper });
    const attempts = renderHook(() => useMyQuizAttempts("q1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/education/quizzes?siteId=site-2&status=PUBLISHED",
      );
      expect(apiFetch).toHaveBeenCalledWith("/education/quizzes/q1");
      expect(apiFetch).toHaveBeenCalledWith(
        "/education/quizzes/q1/my-attempts",
      );
      expect(quizzes.result.current.data).toEqual([{ id: "q1" }]);
      expect(quiz.result.current.data).toEqual({ id: "q1", questions: [] });
      expect(attempts.result.current.data).toEqual([{ id: "a1" }]);
    });
  });

  it("submits quiz attempt without question order", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("attempt-id")
      .mockReturnValueOnce("mutation-id");
    vi.mocked(apiFetch).mockResolvedValue({ data: { attempt: { id: "qa1" } } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubmitQuizAttempt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        quizId: "q1",
        answers: { q1: 1, q2: "A" },
      });
    });

    const request = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(request?.[0]).toBe("/education/quizzes/q1/attempt");
    expect(body).toEqual({
      answers: { q1: 1, q2: "A" },
      clientAttemptId: "attempt-id",
    });
    expect(request?.[1]).toMatchObject({
      method: "POST",
      offlineQueue: true,
      offlineMutationType: "submitQuizAttempt",
      clientMutationId: "mutation-id",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["quiz-attempts", "q1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["quizzes"] });
  });

  it("submits quiz attempt with ordered answers branch", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("attempt-id-2")
      .mockReturnValueOnce("mutation-id-2");
    vi.mocked(apiFetch).mockResolvedValue({ data: { attempt: { id: "qa2" } } });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitQuizAttempt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        quizId: "q2",
        answers: { q1: 2 },
        questionOrder: ["q1", "q2"],
      });
    });

    const request = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body).toEqual({
      answers: [2, ""],
      clientAttemptId: "attempt-id-2",
    });
  });

  it("fetches education completion status with enabled guard", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { completion: null } });
    const { wrapper } = createWrapper();

    renderHook(() => useEducationCompletionStatus(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    const { result } = renderHook(
      () => useEducationCompletionStatus("content-1"),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/education/completions/content-1/me",
      );
      expect(result.current.data).toEqual({ completion: null });
    });
  });

  it("submits education completion and invalidates completion query", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: { completion: { id: "comp-1" } },
    });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSubmitEducationCompletion(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        contentId: "content-1",
        signature: "data:image/png;base64,abc",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/education/completions", {
      method: "POST",
      body: JSON.stringify({
        contentId: "content-1",
        signature: "data:image/png;base64,abc",
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["education-completion", "content-1"],
    });
  });

  it("maps tbm records including leader and no-leader branches", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: {
        records: [
          {
            tbm: {
              id: "tbm-1",
              siteId: "site-1",
              date: 1711111111,
              topic: "작업 전 점검",
              content: "내용",
              leaderId: "u1",
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
            leaderName: "홍길동",
            attendeeCount: 3,
          },
          {
            tbm: {
              id: "tbm-2",
              siteId: "site-1",
              date: 1711111111,
              topic: "장비 점검",
              content: null,
              leaderId: "u2",
              createdAt: "2026-01-01",
              updatedAt: "2026-01-01",
            },
            leaderName: "",
          },
        ],
      },
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTbmRecords("site-1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/education/tbm?siteId=site-1");
      expect(result.current.data?.[0]?.leader).toEqual({
        nameMasked: "홍길동",
      });
      expect(result.current.data?.[1]?.leader).toBeUndefined();
      expect(result.current.data?.[0]?._count.attendees).toBe(3);
      expect(result.current.data?.[1]?._count.attendees).toBe(0);
    });
  });

  it("attends tbm and invalidates tbm-records query", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAttendTbm(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("tbm-1");
    });

    expect(apiFetch).toHaveBeenCalledWith("/education/tbm/tbm-1/attend", {
      method: "POST",
      body: JSON.stringify({ tbmRecordId: "tbm-1" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tbm-records"] });
  });
});
