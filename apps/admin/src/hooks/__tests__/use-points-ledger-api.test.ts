import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAwardPoints, usePointsLedger } from "@/hooks/use-points-ledger-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig<TVariables> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
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

describe("use-points-ledger-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("loads points ledger entries and respects site enabled state", async () => {
    apiFetchMock.mockResolvedValue({ entries: [{ id: "p1" }] });
    usePointsLedger();
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "points", "site-1"]);
    expect(config.enabled).toBe(true);
    await expect(config.queryFn()).resolves.toEqual([{ id: "p1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/points/history?siteId=site-1");

    authState = { currentSiteId: null };
    usePointsLedger();
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("awards points and invalidates admin point/member queries", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    useAwardPoints();
    const config = useMutationMock.mock.calls[0][0] as MutationConfig<{
      userId: string;
      amount: number;
      reason: string;
    }>;

    await config.mutationFn({ userId: "u1", amount: 10, reason: "good" });
    expect(apiFetchMock).toHaveBeenCalledWith("/points/award", {
      method: "POST",
      body: JSON.stringify({
        siteId: "site-1",
        userId: "u1",
        amount: 10,
        reasonCode: "MANUAL_AWARD",
        reasonText: "good",
      }),
    });
    config.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "points"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "members"],
    });
  });

  it("rejects award mutation when site is not selected", async () => {
    authState = { currentSiteId: null };
    useAwardPoints();
    const config = useMutationMock.mock.calls[0][0] as MutationConfig<{
      userId: string;
      amount: number;
      reason: string;
    }>;

    await expect(
      config.mutationFn({ userId: "u1", amount: 5, reason: "x" }),
    ).rejects.toThrow("현장이 선택되지 않았습니다.");
  });
});
