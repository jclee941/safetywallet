import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useActionImageAiAnalysis,
  useActionImages,
  useTriggerActionImageAnalysis,
} from "@/hooks/use-action-ai-analysis";

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
const useMutationMock =
  vi.fn<
    (config: MutationConfig<{ actionId: string; imageId: string }>) => unknown
  >();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (
    config: MutationConfig<{ actionId: string; imageId: string }>,
  ) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-action-ai-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("loads action images and defaults to empty list", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: { id: "a1", images: [{ id: "img1" }] } })
      .mockResolvedValueOnce({ data: { id: "a1" } });

    useActionImages("a1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "actions", "a1", "images"]);
    expect(config.enabled).toBe(true);
    await expect(config.queryFn()).resolves.toEqual([{ id: "img1" }]);
    await expect(config.queryFn()).resolves.toEqual([]);

    authState = { currentSiteId: null };
    useActionImages("a1");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("loads action image AI analysis with enable guard", async () => {
    apiFetchMock.mockResolvedValue({
      aiAnalysis: { label: "ok" },
      aiAnalyzedAt: null,
    });
    useActionImageAiAnalysis("a2", "img2");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "actions",
      "a2",
      "images",
      "img2",
      "ai-analysis",
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/actions/a2/images/img2/ai-analysis",
    );

    useActionImageAiAnalysis("", "img2");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("triggers image analysis and invalidates action image keys", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    useTriggerActionImageAnalysis();
    const config = useMutationMock.mock.calls[0][0];
    const variables = { actionId: "a3", imageId: "img3" };
    await config.mutationFn(variables);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/actions/a3/images/img3/analyze",
      {
        method: "POST",
      },
    );

    config.onSuccess?.({}, variables);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions", "a3", "images", "img3", "ai-analysis"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions", "a3", "images"],
    });
  });
});
