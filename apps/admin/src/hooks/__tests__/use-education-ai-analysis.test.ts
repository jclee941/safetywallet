import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useEducationAiAnalysis,
  useTriggerEducationAiAnalysis,
} from "@/hooks/use-education-ai-analysis";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig = {
  mutationFn: (contentId: string) => Promise<unknown>;
  onSuccess?: (data: unknown, contentId: string) => void;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const useMutationMock = vi.fn<(config: MutationConfig) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-education-ai-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("queries education AI analysis with site guard", async () => {
    apiFetchMock.mockResolvedValue({ aiAnalysis: { score: 1 } });
    useEducationAiAnalysis("content-1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "education",
      "contents",
      "content-1",
      "ai-analysis",
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/contents/content-1/ai-analysis",
    );

    authState = { currentSiteId: null };
    useEducationAiAnalysis("content-1");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);

    authState = { currentSiteId: "site-1" };
    useEducationAiAnalysis(null);
    expect(useQueryMock.mock.calls[2][0].enabled).toBe(false);
  });

  it("triggers analysis and invalidates analysis query", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    useTriggerEducationAiAnalysis();
    const config = useMutationMock.mock.calls[0][0];
    await config.mutationFn("content-2");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/contents/content-2/analyze",
      {
        method: "POST",
      },
    );

    config.onSuccess?.({}, "content-2");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "education", "contents", "content-2", "ai-analysis"],
    });
  });
});
