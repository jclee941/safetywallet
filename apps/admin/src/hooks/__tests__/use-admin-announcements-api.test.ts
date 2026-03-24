import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/use-admin-announcements-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
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

describe("use-admin-announcements-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("returns announcements from data, array, and empty branches", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ data: [{ id: "a1" }] })
      .mockResolvedValueOnce([{ id: "a2" }])
      .mockResolvedValueOnce({});

    useAdminAnnouncements();
    const withSite = useQueryMock.mock.calls[0][0];
    expect(withSite.queryKey).toEqual(["admin", "announcements", "site-1"]);
    await expect(withSite.queryFn()).resolves.toEqual([{ id: "a1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements?siteId=site-1");

    authState = { currentSiteId: null };
    useAdminAnnouncements();
    const noSite = useQueryMock.mock.calls[1][0];
    await expect(noSite.queryFn()).resolves.toEqual([{ id: "a2" }]);
    await expect(noSite.queryFn()).resolves.toEqual([]);
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements");
  });

  it("creates, updates, deletes announcement and invalidates list", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateAnnouncement();
    const createConfig = useMutationMock.mock.calls[0][0] as MutationConfig<{
      title: string;
      content: string;
      isPinned?: boolean;
      scheduledAt?: string | null;
    }>;
    await createConfig.mutationFn({ title: "t", content: "c", isPinned: true });
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements", {
      method: "POST",
      body: JSON.stringify({
        siteId: "site-1",
        title: "t",
        content: "c",
        isPinned: true,
        scheduledAt: undefined,
      }),
    });
    createConfig.onSuccess?.();

    useUpdateAnnouncement();
    const updateConfig = useMutationMock.mock.calls[1][0] as MutationConfig<{
      id: string;
      title: string;
      content: string;
      isPinned?: boolean;
      scheduledAt?: string | null;
    }>;
    await updateConfig.mutationFn({
      id: "a1",
      title: "u",
      content: "uc",
      scheduledAt: null,
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements/a1", {
      method: "PATCH",
      body: JSON.stringify({
        title: "u",
        content: "uc",
        isPinned: undefined,
        scheduledAt: null,
      }),
    });
    updateConfig.onSuccess?.();

    useDeleteAnnouncement();
    const deleteConfig = useMutationMock.mock
      .calls[2][0] as MutationConfig<string>;
    await deleteConfig.mutationFn("a2");
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements/a2", {
      method: "DELETE",
    });
    deleteConfig.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "announcements"],
    });
  });
});
