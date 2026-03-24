import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAnomalyInsights,
  useDuplicateRecommendations,
  useIssueTriage,
  usePolicyQuery,
  useReviewCopilot,
  useSummaryReport,
} from "@/hooks/use-ai-insights-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-ai-insights-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
  });

  it("builds issue triage URL and defaults", async () => {
    apiFetchMock.mockResolvedValue({ items: [] });
    useIssueTriage();
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "ai-insights",
      "issue-triage",
      "site-1",
      7,
      20,
    ]);
    expect(config.enabled).toBe(true);
    expect(config.refetchInterval).toBe(60000);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/admin/ai-insights/issue-triage?siteId=site-1&days=7&limit=20",
    );
  });

  it("builds review/duplicates/summary/anomaly URLs", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useReviewCopilot(3);
    await useQueryMock.mock.calls[0][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/review-copilot?siteId=site-1&days=3",
    );

    useDuplicateRecommendations(11, 5);
    await useQueryMock.mock.calls[1][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/duplicates?siteId=site-1&days=11&limit=5",
    );

    useSummaryReport(9);
    await useQueryMock.mock.calls[2][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/summary-report?siteId=site-1&days=9",
    );

    useAnomalyInsights(12);
    await useQueryMock.mock.calls[3][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/anomalies?siteId=site-1&days=12",
    );
  });

  it("builds policy query with trimmed question and staleTime", async () => {
    apiFetchMock.mockResolvedValue({ answer: [] });
    usePolicyQuery("  hi policy  ");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "ai-insights",
      "policy-query",
      "site-1",
      "hi policy",
    ]);
    expect(config.staleTime).toBe(10000);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/admin/ai-insights/policy-query?siteId=site-1&question=hi+policy",
    );
  });

  it("disables all queries when site is missing and short question", () => {
    authState = { currentSiteId: null };
    useIssueTriage(1, 1);
    useReviewCopilot(1);
    useDuplicateRecommendations(1, 1);
    useSummaryReport(1);
    useAnomalyInsights(1);
    usePolicyQuery(" a ");

    for (const call of useQueryMock.mock.calls) {
      expect(call[0].enabled).toBe(false);
    }
  });

  it("covers no-site URL branches by invoking queryFn directly", async () => {
    authState = { currentSiteId: null };
    apiFetchMock.mockResolvedValue({ ok: true });

    useIssueTriage(2, 3);
    await useQueryMock.mock.calls[0][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/issue-triage?days=2&limit=3",
    );

    useReviewCopilot(4);
    await useQueryMock.mock.calls[1][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/review-copilot?days=4",
    );

    useDuplicateRecommendations(5, 6);
    await useQueryMock.mock.calls[2][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/duplicates?days=5&limit=6",
    );

    useSummaryReport(8);
    await useQueryMock.mock.calls[3][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/summary-report?days=8",
    );

    useAnomalyInsights(9);
    await useQueryMock.mock.calls[4][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/anomalies?days=9",
    );

    usePolicyQuery("  policy  ");
    await useQueryMock.mock.calls[5][0].queryFn();
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/admin/ai-insights/policy-query?question=policy",
    );
  });
});
