import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useBeforeAfterComparison,
  useTriggerBeforeAfterComparison,
} from "@/hooks/use-before-after-comparison";

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

describe("use-before-after-comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("queries comparison with proper key and enabled guard", async () => {
    apiFetchMock.mockResolvedValue({ comparison: null, comparedAt: null });
    useBeforeAfterComparison("action-1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "actions",
      "action-1",
      "comparison",
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/actions/action-1/comparison");

    authState = { currentSiteId: null };
    useBeforeAfterComparison("action-1");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);

    authState = { currentSiteId: "site-1" };
    useBeforeAfterComparison(null);
    expect(useQueryMock.mock.calls[2][0].enabled).toBe(false);
  });

  it("triggers comparison and invalidates related queries", async () => {
    apiFetchMock.mockResolvedValue({ comparedAt: "2026-01-01" });
    useTriggerBeforeAfterComparison();
    const config = useMutationMock.mock.calls[0][0];
    await config.mutationFn("action-2");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/actions/action-2/compare-images",
      {
        method: "POST",
      },
    );

    config.onSuccess?.({}, "action-2");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions", "action-2", "comparison"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions", "action-2", "images"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "actions"],
    });
  });
});
