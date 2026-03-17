"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  apiFetch,
  useAuthStore,
  type ApiResponse,
} from "./use-api-base";

export interface TodayRecommendationData {
  hasRecommendedToday: boolean;
  recommendation: {
    id: string;
    recommendedName: string;
    tradeType: string;
    reason: string;
    recommendationDate: string;
  } | null;
}

export interface RecommendationRecord {
  id: string;
  recommendedName: string;
  tradeType: string;
  reason: string;
  recommendationDate: string;
  createdAt: string;
}

export function useTodayRecommendation() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  return useQuery<ApiResponse<TodayRecommendationData>>({
    queryKey: ["recommendations", "today", currentSiteId],
    queryFn: () =>
      apiFetch<ApiResponse<TodayRecommendationData>>(
        `/recommendations/today?siteId=${currentSiteId}`,
      ),
    enabled: !!currentSiteId,
  });
}

export function useMyRecommendationHistory(enabled = true) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  return useQuery<ApiResponse<RecommendationRecord[]>>({
    queryKey: ["recommendations", "my", currentSiteId],
    queryFn: () =>
      apiFetch<ApiResponse<RecommendationRecord[]>>(
        `/recommendations/my?siteId=${currentSiteId}`,
      ),
    enabled: !!currentSiteId && enabled,
  });
}

export function useRecommendationHistory() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  return useQuery<ApiResponse<{ items: unknown[] }>>({
    queryKey: ["recommendations", "history", currentSiteId],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: unknown[] }>>(
        `/recommendations/history?siteId=${currentSiteId}`,
      ),
    enabled: !!currentSiteId,
  });
}

export function useSubmitRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      recommendedName: string;
      tradeType: string;
      reason: string;
      siteId: string;
    }) => {
      const clientMutationId = crypto.randomUUID();
      return apiFetch<ApiResponse<{ id: string }>>("/recommendations", {
        method: "POST",
        body: JSON.stringify({ ...data, clientMutationId }),
        offlineQueue: true,
        offlineMutationType: "submitRecommendation",
        clientMutationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}
