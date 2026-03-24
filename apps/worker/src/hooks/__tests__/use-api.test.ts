import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ActionStatus, Category } from "@safetywallet/types";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useAttendTbm,
  useAction,
  useAnnouncements,
  useAttendanceToday,
  useCreatePost,
  useDeleteActionImage,
  useEducationContent,
  useEducationContents,
  useEducationCompletionStatus,
  useSubmitEducationCompletion,
  useLeaveSite,
  useMyActions,
  useMyQuizAttempts,
  usePoints,
  usePost,
  usePosts,
  useProfile,
  useQuiz,
  useQuizzes,
  useRecommendationHistory,
  useSiteInfo,
  useSubmitQuizAttempt,
  useSubmitRecommendation,
  useSystemStatus,
  useTbmRecords,
  useTodayRecommendation,
  useUploadActionImage,
  useUpdateActionStatus,
} from "@/hooks/use-api";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

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

describe("use-api hooks", () => {
  it("re-exports hook modules from barrel", async () => {
    const api = await import("../use-api");
    expect(typeof api.usePosts).toBe("function");
    expect(typeof api.useSystemStatus).toBe("function");
    expect(typeof api.useEducationContents).toBe("function");
    expect(typeof api.useMyActions).toBe("function");
  });

  it("usePosts fetches post list for site", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0 });
    const { wrapper } = createWrapper();

    renderHook(() => usePosts("site-1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/posts?siteId=site-1");
    });
  });

  it("usePosts does not fetch without site id", () => {
    const { wrapper } = createWrapper();
    renderHook(() => usePosts(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("usePost fetches single post by id", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "post-1" } });
    const { wrapper } = createWrapper();

    renderHook(() => usePost("post-1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/posts/post-1");
    });
  });

  it("useCreatePost posts payload and invalidates posts query", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { post: { id: "p1" } } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        siteId: "site-2",
        category: Category.HAZARD,
        content: "테스트 게시글",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/posts",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"siteId":"site-2"'),
        offlineQueue: true,
        offlineMutationType: "createPost",
        clientMutationId: expect.any(String),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["posts", "site-2"],
    });
  });

  it("useSiteInfo and useProfile call expected endpoints", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        data: {
          site: { id: "s1", name: "현장", address: null, memberCount: 3 },
        },
      })
      .mockResolvedValueOnce({ data: { id: "u1" } });

    const { wrapper } = createWrapper();
    renderHook(() => useSiteInfo("s1"), { wrapper });
    renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/sites/s1");
      expect(apiFetch).toHaveBeenCalledWith("/users/me");
    });
  });

  it("usePoints and useAnnouncements fetch with site id", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { balance: 100, history: [] } })
      .mockResolvedValueOnce({ success: true, data: { items: [], total: 0 } });
    const { wrapper } = createWrapper();

    renderHook(() => usePoints("site-3"), { wrapper });
    renderHook(() => useAnnouncements("site-3"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/points?siteId=site-3");
      expect(apiFetch).toHaveBeenCalledWith("/announcements?siteId=site-3");
    });
  });

  it("useSystemStatus calls public endpoint with skipAuth option", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { notices: [], hasIssues: false },
    });
    const { wrapper } = createWrapper();

    renderHook(() => useSystemStatus(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/system/status", {
        skipAuth: true,
      });
    });
  });

  it("useEducationContents and useEducationContent return transformed payload", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        success: true,
        data: {
          contents: [
            {
              id: "c1",
              siteId: "s",
              title: "t",
              content: "c",
              contentType: "TEXT",
              category: "GEN",
              isRequired: false,
              displayOrder: 1,
              createdAt: "2026-01-01",
            },
          ],
        },
        timestamp: "2026-01-01T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: "c2",
          title: "제목",
          content: "본문",
          contentType: "TEXT",
          category: "GEN",
          isRequired: false,
          createdAt: "2026-01-01",
        },
        timestamp: "2026-01-01T00:00:00.000Z",
      });

    const { wrapper } = createWrapper();
    const list = renderHook(() => useEducationContents("site-7"), { wrapper });
    const item = renderHook(() => useEducationContent("c2"), { wrapper });

    await waitFor(() => {
      expect(list.result.current.data?.[0]?.id).toBe("c1");
      expect(item.result.current.data?.id).toBe("c2");
    });
  });

  it("useAttendanceToday respects enabled flag and endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { attended: true, checkinAt: null },
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const { wrapper } = createWrapper();

    renderHook(() => useAttendanceToday(null), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    renderHook(() => useAttendanceToday("site-10"), { wrapper });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/attendance/today?siteId=site-10");
    });
  });

  it("useMyActions builds query string from params", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    });
    const { wrapper } = createWrapper();

    renderHook(
      () => useMyActions({ status: "IN_PROGRESS", limit: 20, offset: 40 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/actions/my?status=IN_PROGRESS&limit=20&offset=40",
      );
    });
  });

  it("useMyActions sets each search param branch when provided", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    });
    const { wrapper } = createWrapper();

    renderHook(() => useMyActions({ status: "ASSIGNED" }), { wrapper });
    renderHook(() => useMyActions({ limit: 10 }), { wrapper });
    renderHook(() => useMyActions({ offset: 30 }), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/actions/my?status=ASSIGNED");
      expect(apiFetch).toHaveBeenCalledWith("/actions/my?limit=10");
      expect(apiFetch).toHaveBeenCalledWith("/actions/my?offset=30");
    });
  });

  it("useMyActions with no params calls /actions/my without query string", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    });
    const { wrapper } = createWrapper();

    renderHook(() => useMyActions(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/actions/my");
    });
  });

  it("useAction does not fetch when actionId is null", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useAction(null), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("useAction fetches action when actionId is provided", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: { id: "a1", title: "Fix railing" },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAction("a1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith("/actions/a1");
  });

  it("useUpdateActionStatus patches action and invalidates action queries", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "a1" } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateActionStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        actionId: "a1",
        data: { actionStatus: ActionStatus.IN_PROGRESS },
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/a1", {
      method: "PATCH",
      body: JSON.stringify({ actionStatus: ActionStatus.IN_PROGRESS }),
      offlineQueue: true,
      offlineMutationType: "updateActionStatus",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["actions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["actions", "a1"] });
  });

  it("recommendation hooks use current site id from auth store", async () => {
    useAuthStore.setState({ currentSiteId: "site-r" });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        data: { hasRecommendedToday: false, recommendation: null },
      })
      .mockResolvedValueOnce({ data: { items: [] } });

    const { wrapper } = createWrapper();

    renderHook(() => useTodayRecommendation(), { wrapper });
    renderHook(() => useRecommendationHistory(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/recommendations/today?siteId=site-r",
      );
      expect(apiFetch).toHaveBeenCalledWith(
        "/recommendations/history?siteId=site-r",
      );
    });
  });

  it("useSubmitRecommendation posts payload and invalidates recommendations", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "rec-1" } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSubmitRecommendation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        recommendedName: "홍길동",
        tradeType: "전기",
        reason: "안전 수칙 준수 우수",
        siteId: "site-r",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/recommendations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"recommendedName":"홍길동"'),
        offlineQueue: true,
        offlineMutationType: "submitRecommendation",
        clientMutationId: expect.any(String),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["recommendations"],
    });
  });

  it("quiz hooks fetch lists/details, submit attempt, and fetch my attempts", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/education/quizzes?siteId=site-q&status=PUBLISHED") {
        return Promise.resolve({
          success: true,
          data: {
            quizzes: [
              {
                id: "q1",
                title: "안전 퀴즈",
                description: null,
                timeLimitMinutes: 10,
                maxAttempts: 3,
                isActive: true,
                createdAt: "2026-01-01",
              },
            ],
          },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }
      if (url === "/education/quizzes/q1") {
        return Promise.resolve({
          success: true,
          data: {
            id: "q1",
            title: "안전 퀴즈",
            description: null,
            timeLimitMinutes: 10,
            maxAttempts: 3,
            questions: [],
          },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }

      if (url === "/education/quizzes/q1/my-attempts") {
        return Promise.resolve({
          success: true,
          data: { attempts: [] },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }

      if (url === "/education/quizzes/q1/attempt") {
        return Promise.resolve({
          success: true,
          data: {
            attempt: {
              id: "qa1",
              score: 100,
              passed: true,
              totalQuestions: 2,
              correctCount: 2,
            },
          },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }

      return Promise.resolve({});
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const list = renderHook(() => useQuizzes("site-q"), { wrapper });
    const detail = renderHook(() => useQuiz("q1"), { wrapper });
    const attempts = renderHook(() => useMyQuizAttempts("q1"), { wrapper });
    const submit = renderHook(() => useSubmitQuizAttempt(), { wrapper });

    await waitFor(() => {
      expect(list.result.current.data?.[0]?.id).toBe("q1");
      expect(detail.result.current.data?.id).toBe("q1");
      expect(attempts.result.current.data).toEqual([]);
    });

    await act(async () => {
      await submit.result.current.mutateAsync({
        quizId: "q1",
        answers: { question1: 1 },
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/education/quizzes?siteId=site-q&status=PUBLISHED",
    );
    expect(apiFetch).toHaveBeenCalledWith("/education/quizzes/q1");
    expect(apiFetch).toHaveBeenCalledWith("/education/quizzes/q1/my-attempts");
    expect(apiFetch).toHaveBeenCalledWith(
      "/education/quizzes/q1/attempt",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"answers"'),
        offlineQueue: true,
        offlineMutationType: "submitQuizAttempt",
        clientMutationId: expect.any(String),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["quiz-attempts", "q1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["quizzes"] });
  });

  it("education completion hooks fetch status and submit signature", async () => {
    vi.mocked(apiFetch).mockImplementation((url, options) => {
      if (url === "/education/completions/content-1/me") {
        return Promise.resolve({
          success: true,
          data: { completion: null },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }
      if (url === "/education/completions") {
        return Promise.resolve({
          success: true,
          data: {
            completion: {
              id: "comp-1",
              signedAt: "2026-01-01T00:00:00.000Z",
              signatureData: "data:image/png;base64,abc",
            },
          },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }
      return Promise.resolve({});
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const status = renderHook(() => useEducationCompletionStatus("content-1"), {
      wrapper,
    });
    const submit = renderHook(() => useSubmitEducationCompletion(), {
      wrapper,
    });

    await waitFor(() => {
      expect(status.result.current.data?.completion).toBeNull();
    });

    await act(async () => {
      await submit.result.current.mutateAsync({
        contentId: "content-1",
        signature: "data:image/png;base64,signed",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/education/completions/content-1/me",
    );
    expect(apiFetch).toHaveBeenCalledWith("/education/completions", {
      method: "POST",
      body: JSON.stringify({
        contentId: "content-1",
        signature: "data:image/png;base64,signed",
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["education-completion", "content-1"],
    });
  });

  it("tbm hooks fetch records and attendance mutation invalidates tbm list", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/education/tbm?siteId=site-t") {
        return Promise.resolve({
          success: true,
          data: { records: [] },
          timestamp: "2026-01-01T00:00:00.000Z",
        });
      }

      if (url === "/education/tbm/tbm-1/attend") {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({});
    });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useTbmRecords("site-t"), { wrapper });
    const attend = renderHook(() => useAttendTbm(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/education/tbm?siteId=site-t");
    });

    await act(async () => {
      await attend.result.current.mutateAsync("tbm-1");
    });

    expect(apiFetch).toHaveBeenCalledWith("/education/tbm/tbm-1/attend", {
      method: "POST",
      body: JSON.stringify({ tbmRecordId: "tbm-1" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tbm-records"] });
  });

  it("action image hooks upload/delete and invalidate action detail", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { id: "img-1", fileUrl: "https://file" } })
      .mockResolvedValueOnce({ data: null });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const upload = renderHook(() => useUploadActionImage(), { wrapper });
    const del = renderHook(() => useDeleteActionImage(), { wrapper });
    const formData = new FormData();
    formData.set("file", "blob");

    await act(async () => {
      await upload.result.current.mutateAsync({
        actionId: "action-1",
        formData,
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/action-1/images", {
      method: "POST",
      body: formData,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["actions", "action-1"],
    });

    await act(async () => {
      await del.result.current.mutateAsync({
        actionId: "action-1",
        imageId: "img-1",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/action-1/images/img-1", {
      method: "DELETE",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["actions", "action-1"],
    });
  });

  it("useLeaveSite posts reason and invalidates site/profile", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { message: "ok" } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLeaveSite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        siteId: "site-55",
        reason: "퇴근",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/sites/site-55/leave", {
      method: "POST",
      body: JSON.stringify({ reason: "퇴근" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["site"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });
});
