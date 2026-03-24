import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useUpdatePolicy,
} from "@/hooks/use-points-policies-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig<TVariables, TData = unknown> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const useMutationMock =
  vi.fn<(config: MutationConfig<unknown, unknown>) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig<unknown, unknown>) =>
    useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-points-policies-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("loads policies by target site and handles enabled guard", async () => {
    apiFetchMock.mockResolvedValue({ policies: [{ id: "p1" }] });
    usePolicies("site-2");
    const explicit = useQueryMock.mock.calls[0][0];
    expect(explicit.queryKey).toEqual(["admin", "policies", "site-2"]);
    expect(explicit.enabled).toBe(true);
    await expect(explicit.queryFn()).resolves.toEqual([{ id: "p1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/policies/site/site-2");

    authState = { currentSiteId: null };
    usePolicies();
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("creates policy and handles missing site error plus invalidation", async () => {
    apiFetchMock.mockResolvedValue({ policy: { id: "p2", siteId: "site-3" } });
    useCreatePolicy();
    const createConfig = useMutationMock.mock.calls[0][0] as MutationConfig<
      {
        siteId?: string;
        reasonCode: string;
        name: string;
        defaultAmount: number;
      },
      { policy: { id: string; siteId: string } }
    >;

    await createConfig.mutationFn({
      siteId: "site-3",
      reasonCode: "R1",
      name: "n",
      defaultAmount: 1,
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/policies", {
      method: "POST",
      body: JSON.stringify({
        siteId: "site-3",
        reasonCode: "R1",
        name: "n",
        defaultAmount: 1,
      }),
    });

    createConfig.onSuccess?.(
      { policy: { id: "p2", siteId: "site-3" } },
      { reasonCode: "R1", name: "n", defaultAmount: 1 },
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "policies", "site-1"],
    });

    authState = { currentSiteId: null };
    useCreatePolicy();
    const noSiteCreate = useMutationMock.mock.calls[1][0] as MutationConfig<
      { reasonCode: string; name: string; defaultAmount: number },
      unknown
    >;
    expect(() =>
      noSiteCreate.mutationFn({ reasonCode: "R", name: "n", defaultAmount: 1 }),
    ).toThrow("Site ID is required");
  });

  it("updates and deletes policies with conditional invalidation", async () => {
    useUpdatePolicy();
    const updateConfig = useMutationMock.mock.calls[0][0] as MutationConfig<
      { id: string; data: { name: string } },
      { policy: { siteId: string } }
    >;
    apiFetchMock.mockResolvedValue({ policy: { siteId: "site-5" } });
    await updateConfig.mutationFn({ id: "p5", data: { name: "new" } });
    expect(apiFetchMock).toHaveBeenCalledWith("/policies/p5", {
      method: "PATCH",
      body: JSON.stringify({ name: "new" }),
    });
    updateConfig.onSuccess?.(
      { policy: { siteId: "site-5" } },
      { id: "p5", data: { name: "new" } },
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "policies", "site-5"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "policies", "site-1"],
    });

    authState = { currentSiteId: null };
    useUpdatePolicy();
    const updateNoCurrent = useMutationMock.mock.calls[1][0] as MutationConfig<
      { id: string; data: { name: string } },
      { policy: { siteId: string } }
    >;
    updateNoCurrent.onSuccess?.(
      { policy: { siteId: "site-7" } },
      { id: "p7", data: { name: "x" } },
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "policies", "site-7"],
    });

    authState = { currentSiteId: "site-1" };
    useDeletePolicy();
    const deleteConfig = useMutationMock.mock
      .calls[2][0] as MutationConfig<string>;
    apiFetchMock.mockResolvedValue({ ok: true });
    await deleteConfig.mutationFn("p6");
    expect(apiFetchMock).toHaveBeenCalledWith("/policies/p6", {
      method: "DELETE",
    });
    deleteConfig.onSuccess?.({}, "p6");
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "policies", "site-1"],
    });

    authState = { currentSiteId: null };
    useDeletePolicy();
    const deleteNoSite = useMutationMock.mock
      .calls[3][0] as MutationConfig<string>;
    deleteNoSite.onSuccess?.({}, "x");
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(4);
  });
});
