import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMySites } from "@/hooks/use-admin-sites-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const apiFetchMock = vi.fn();

type AuthState = {
  user?: { role?: string } | null;
  _hasHydrated: boolean;
  isAdmin: boolean;
};
let authState: AuthState = {
  user: { role: "SITE_ADMIN" },
  _hasHydrated: true,
  isAdmin: true,
};

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

describe("use-admin-sites-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = {
      user: { role: "SITE_ADMIN" },
      _hasHydrated: true,
      isAdmin: true,
    };
    useQueryMock.mockImplementation((config) => config);
  });

  it("maps memberships to site membership rows", async () => {
    apiFetchMock.mockResolvedValue({
      memberships: [
        {
          id: "m1",
          role: "ADMIN",
          status: "ACTIVE",
          joinedAt: "2026-01-01",
          site: { id: "s1", name: "Site One", active: true },
        },
      ],
    });
    useMySites();
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "my-sites", "SITE_ADMIN"]);
    expect(config.enabled).toBe(true);
    await expect(config.queryFn()).resolves.toEqual([
      {
        id: "m1",
        siteId: "s1",
        siteName: "Site One",
        status: "ACTIVE",
        role: "ADMIN",
        joinedAt: "2026-01-01",
      },
    ]);
  });

  it("falls back to /sites for super admin with no memberships", async () => {
    authState = {
      user: { role: "SUPER_ADMIN" },
      _hasHydrated: true,
      isAdmin: true,
    };
    apiFetchMock
      .mockResolvedValueOnce({ memberships: [] })
      .mockResolvedValueOnce({ data: [{ id: "s2", name: "Site Two" }] });

    useMySites();
    const config = useQueryMock.mock.calls[0][0];
    const result = (await config.queryFn()) as Array<{
      id: string;
      siteId: string;
      siteName: string;
      status: string;
      role: string;
      joinedAt: string;
    }>;
    expect(result[0].id).toBe("super-admin-s2");
    expect(result[0].siteId).toBe("s2");
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].role).toBe("SUPER_ADMIN");
  });

  it("returns empty memberships for non-super-admin and supports disabled state", async () => {
    apiFetchMock.mockResolvedValue({ memberships: [] });
    useMySites();
    const config = useQueryMock.mock.calls[0][0];
    await expect(config.queryFn()).resolves.toEqual([]);

    authState = { user: null, _hasHydrated: false, isAdmin: false };
    useMySites();
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });
});
