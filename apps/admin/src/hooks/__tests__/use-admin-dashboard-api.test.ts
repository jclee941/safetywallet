import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardStats } from "@/hooks/use-admin-dashboard-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
  refetchInterval?: number;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const apiFetchMock = vi.fn();

type AuthState = { isAdmin: boolean; _hasHydrated: boolean };
let authState: AuthState = { isAdmin: true, _hasHydrated: true };

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

describe("use-admin-dashboard-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { isAdmin: true, _hasHydrated: true };
    useQueryMock.mockImplementation((config) => config);
  });

  it("loads dashboard stats when hydrated admin", async () => {
    apiFetchMock.mockResolvedValue({ stats: { totalUsers: 1 } });
    useDashboardStats();
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["dashboard", "stats"]);
    expect(config.enabled).toBe(true);
    expect(config.refetchInterval).toBe(30000);
    await expect(config.queryFn()).resolves.toEqual({ totalUsers: 1 });
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/stats");
  });

  it("disables dashboard stats when not hydrated or not admin", () => {
    authState = { isAdmin: false, _hasHydrated: true };
    useDashboardStats();
    expect(useQueryMock.mock.calls[0][0].enabled).toBe(false);

    authState = { isAdmin: true, _hasHydrated: false };
    useDashboardStats();
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });
});
