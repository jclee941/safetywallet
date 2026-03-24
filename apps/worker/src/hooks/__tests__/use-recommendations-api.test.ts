import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useMyRecommendationHistory,
  useRecommendationHistory,
  useSubmitRecommendation,
  useTodayRecommendation,
} from "@/hooks/use-recommendations-api";
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

describe("use-recommendations-api", () => {
  afterEach(() => {
    useAuthStore.setState({ currentSiteId: null });
    vi.restoreAllMocks();
  });

  it("guards recommendation queries when currentSiteId is missing", () => {
    const { wrapper } = createWrapper();

    renderHook(() => useTodayRecommendation(), { wrapper });
    renderHook(() => useRecommendationHistory(), { wrapper });
    renderHook(() => useMyRecommendationHistory(), { wrapper });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches recommendation queries when currentSiteId exists", async () => {
    useAuthStore.setState({ currentSiteId: "site-r" });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        data: { hasRecommendedToday: false, recommendation: null },
      })
      .mockResolvedValueOnce({ data: { items: [] } })
      .mockResolvedValueOnce({ data: [] });

    const { wrapper } = createWrapper();

    renderHook(() => useTodayRecommendation(), { wrapper });
    renderHook(() => useRecommendationHistory(), { wrapper });
    renderHook(() => useMyRecommendationHistory(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/recommendations/today?siteId=site-r",
      );
      expect(apiFetch).toHaveBeenCalledWith(
        "/recommendations/history?siteId=site-r",
      );
      expect(apiFetch).toHaveBeenCalledWith(
        "/recommendations/my?siteId=site-r",
      );
    });
  });

  it("respects explicit enabled=false in useMyRecommendationHistory", () => {
    useAuthStore.setState({ currentSiteId: "site-r" });
    const { wrapper } = createWrapper();

    renderHook(() => useMyRecommendationHistory(false), { wrapper });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("submits recommendation with offline metadata and invalidates query", async () => {
    useAuthStore.setState({ currentSiteId: "site-r" });
    vi.spyOn(crypto, "randomUUID").mockReturnValue("recommendation-mutation");
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "rec-1" } });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSubmitRecommendation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        recommendedName: "홍길동",
        tradeType: "전기",
        reason: "안전 수칙 준수",
        siteId: "site-r",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/recommendations",
      expect.objectContaining({
        method: "POST",
        offlineQueue: true,
        offlineMutationType: "submitRecommendation",
        clientMutationId: "recommendation-mutation",
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["recommendations"],
    });
  });
});
