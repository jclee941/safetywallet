import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useApproveManualRequest,
  useCreateManualApproval,
  useManualApprovals,
  useRejectManualRequest,
} from "@/hooks/use-admin-approvals-api";

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
const useMutationMock = vi.fn<(config: MutationConfig<unknown>) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig<unknown>) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-admin-approvals-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("queries manual approvals with params and response branch handling", async () => {
    apiFetchMock
      .mockResolvedValueOnce([{ id: "m1" }])
      .mockResolvedValueOnce({ data: [{ id: "m2" }] })
      .mockResolvedValueOnce({});

    useManualApprovals("site-2", "2026-03-01", "PENDING");
    const explicit = useQueryMock.mock.calls[0][0];
    expect(explicit.enabled).toBe(true);
    await expect(explicit.queryFn()).resolves.toEqual([{ id: "m1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/approvals?siteId=site-2&date=2026-03-01&status=PENDING",
    );

    useManualApprovals();
    const current = useQueryMock.mock.calls[1][0];
    await expect(current.queryFn()).resolves.toEqual([{ id: "m2" }]);
    await expect(current.queryFn()).resolves.toEqual([]);

    authState = { currentSiteId: null };
    useManualApprovals();
    expect(useQueryMock.mock.calls[2][0].enabled).toBe(false);
  });

  it("approves, rejects, and creates manual approvals with invalidation", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useApproveManualRequest();
    const approveConfig = useMutationMock.mock
      .calls[0][0] as MutationConfig<string>;
    await approveConfig.mutationFn("a1");
    expect(apiFetchMock).toHaveBeenCalledWith("/approvals/a1/approve", {
      method: "POST",
    });
    approveConfig.onSuccess?.({}, "a1");

    useRejectManualRequest();
    const rejectConfig = useMutationMock.mock.calls[1][0] as MutationConfig<{
      id: string;
      reason: string;
    }>;
    await rejectConfig.mutationFn({ id: "a2", reason: "bad" });
    expect(apiFetchMock).toHaveBeenCalledWith("/approvals/a2/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "bad" }),
    });
    rejectConfig.onSuccess?.({}, { id: "a2", reason: "bad" });

    useCreateManualApproval();
    const createConfig = useMutationMock.mock.calls[2][0] as MutationConfig<{
      userId: string;
      siteId: string;
      reason: string;
      validDate: string;
    }>;
    const payload = {
      userId: "u1",
      siteId: "site-2",
      reason: "r",
      validDate: "2026-03-01",
    };
    await createConfig.mutationFn(payload);
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/manual-approval", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    createConfig.onSuccess?.({}, payload);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "manual-approvals"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "manual-approvals", "site-2"],
    });
  });
});
