import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  usePostClassification,
  useTriggerPostClassification,
} from "@/hooks/use-post-classification";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig<TVariables> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: (data: unknown, variables: TVariables) => void;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const useMutationMock = vi.fn<(config: MutationConfig<string>) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig<string>) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-post-classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("builds classification query and parses values", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        post: { aiClassification: null, aiClassifiedAt: null },
      })
      .mockResolvedValueOnce({
        post: {
          aiClassification: JSON.stringify({
            suggestedCategory: "A",
            suggestedHazardType: null,
            suggestedHazardSubcategory: null,
            suggestedRiskLevel: "LOW",
            classificationReason: "ok",
            keyFindings: ["k1"],
            confidence: 0.9,
            modelVersion: "m1",
          }),
          aiClassifiedAt: "2026-01-01",
        },
      })
      .mockResolvedValueOnce({
        post: { aiClassification: "{bad", aiClassifiedAt: undefined },
      })
      .mockResolvedValueOnce({
        post: {
          aiClassification: {
            suggestedCategory: "B",
            suggestedHazardType: "TYPE",
            suggestedHazardSubcategory: "SUB",
            suggestedRiskLevel: "HIGH",
            classificationReason: "reason",
            keyFindings: ["x"],
            confidence: 1,
            modelVersion: "m2",
          },
          aiClassifiedAt: "2026-01-02",
        },
      });

    usePostClassification("post-1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "posts",
      "post-1",
      "classification",
    ]);
    expect(config.enabled).toBe(true);

    await expect(config.queryFn()).resolves.toEqual({
      aiClassification: null,
      aiClassifiedAt: null,
    });
    await expect(config.queryFn()).resolves.toEqual({
      aiClassification: {
        suggestedCategory: "A",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "ok",
        keyFindings: ["k1"],
        confidence: 0.9,
        modelVersion: "m1",
      },
      aiClassifiedAt: "2026-01-01",
    });
    await expect(config.queryFn()).resolves.toEqual({
      aiClassification: null,
      aiClassifiedAt: null,
    });
    await expect(config.queryFn()).resolves.toEqual({
      aiClassification: {
        suggestedCategory: "B",
        suggestedHazardType: "TYPE",
        suggestedHazardSubcategory: "SUB",
        suggestedRiskLevel: "HIGH",
        classificationReason: "reason",
        keyFindings: ["x"],
        confidence: 1,
        modelVersion: "m2",
      },
      aiClassifiedAt: "2026-01-02",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/posts/post-1");
  });

  it("disables classification query when post or site is missing", () => {
    usePostClassification(null);
    expect(useQueryMock.mock.calls[0][0].enabled).toBe(false);

    authState = { currentSiteId: null };
    usePostClassification("post-1");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("triggers classification and invalidates related keys", async () => {
    apiFetchMock.mockResolvedValue({ classification: { modelVersion: "m3" } });

    useTriggerPostClassification();
    const config = useMutationMock.mock.calls[0][0];
    await config.mutationFn("post-9");

    expect(apiFetchMock).toHaveBeenCalledWith("/posts/post-9/ai-classify", {
      method: "POST",
    });

    config.onSuccess?.({}, "post-9");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "posts", "post-9", "classification"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "post", "post-9"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "posts"],
    });
  });
});
