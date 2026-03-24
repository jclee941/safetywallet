import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMember,
  useMembers,
  useSetMemberActiveStatus,
  useToggleLoginExempt,
} from "@/hooks/use-admin-members-api";

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
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig<unknown>) => useMutationMock(config),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-admin-members-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("loads members from array and object response branches", async () => {
    apiFetchMock
      .mockResolvedValueOnce([{ id: "m1" }])
      .mockResolvedValueOnce({ data: [{ id: "m2" }] })
      .mockResolvedValueOnce({});

    useMembers("site-2");
    const firstConfig = useQueryMock.mock.calls[0][0];
    expect(firstConfig.queryKey).toEqual(["admin", "members", "site-2"]);
    expect(await firstConfig.queryFn()).toEqual([{ id: "m1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/sites/site-2/members?limit=100",
    );

    useMembers();
    const secondConfig = useQueryMock.mock.calls[1][0];
    expect(secondConfig.queryKey).toEqual(["admin", "members", "site-1"]);
    expect(await secondConfig.queryFn()).toEqual([{ id: "m2" }]);

    expect(await secondConfig.queryFn()).toEqual([]);
  });

  it("disables members query when no target site and fetches member detail", async () => {
    authState = { currentSiteId: null };
    useMembers();
    expect(useQueryMock.mock.calls[0][0].enabled).toBe(false);

    authState = { currentSiteId: "site-9" };
    apiFetchMock.mockResolvedValue({ member: { id: "member-1" } });
    useMember("member-1");
    const config = useQueryMock.mock.calls[1][0];
    expect(config.enabled).toBe(true);
    expect(await config.queryFn()).toEqual({ id: "member-1" });
    expect(apiFetchMock).toHaveBeenCalledWith("/sites/site-9/members/member-1");

    useMember("");
    expect(useQueryMock.mock.calls[2][0].enabled).toBe(false);
  });

  it("sends member active and loginExempt mutations", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useSetMemberActiveStatus();
    const activeConfig = useMutationMock.mock.calls[0][0] as MutationConfig<{
      userId: string;
      active: boolean;
    }>;
    await activeConfig.mutationFn({ userId: "u1", active: true });
    await activeConfig.mutationFn({ userId: "u1", active: false });
    activeConfig.onSuccess?.();
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/u1/unlock", {
      method: "POST",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/u1/lock", {
      method: "POST",
    });

    useToggleLoginExempt();
    const exemptConfig = useMutationMock.mock.calls[1][0] as MutationConfig<{
      userId: string;
      loginExempt: boolean;
    }>;
    await exemptConfig.mutationFn({ userId: "u2", loginExempt: true });
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/u2/login-exempt", {
      method: "PATCH",
      body: JSON.stringify({ loginExempt: true }),
    });
  });
});
