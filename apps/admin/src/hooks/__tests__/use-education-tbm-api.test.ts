import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateTbmRecord,
  useDeleteTbmRecord,
  useTbmRecord,
  useTbmRecords,
  useUpdateTbmRecord,
} from "@/hooks/use-education-tbm-api";

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

describe("use-education-tbm-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("builds TBM records query params and enabled flag", async () => {
    apiFetchMock.mockResolvedValue({ data: [] });
    useTbmRecords({
      date: "2026-02-02",
      topicCategory:
        "SAFETY" as unknown as import("@safetywallet/types").TbmTopicCategory,
      limit: 10,
      offset: 3,
    });
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "tbm-records",
      "site-1",
      { date: "2026-02-02", topicCategory: "SAFETY", limit: 10, offset: 3 },
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/tbm?siteId=site-1&date=2026-02-02&topicCategory=SAFETY&limit=10&offset=3",
    );

    authState = { currentSiteId: null };
    useTbmRecords();
    const noSiteConfig = useQueryMock.mock.calls[1][0];
    expect(noSiteConfig.enabled).toBe(false);
    await noSiteConfig.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/tbm?");
  });

  it("builds single TBM record query and enable guard", async () => {
    apiFetchMock.mockResolvedValue({ id: "tbm-1" });
    useTbmRecord("tbm-1");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "tbm-record", "site-1", "tbm-1"]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/tbm/tbm-1");

    authState = { currentSiteId: null };
    useTbmRecord("");
    expect(useQueryMock.mock.calls[1][0].enabled).toBe(false);
  });

  it("handles create/update/delete TBM mutations and invalidation", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateTbmRecord();
    const createConfig = useMutationMock.mock.calls[0][0] as MutationConfig<{
      topic: string;
    }>;
    await createConfig.mutationFn({ topic: "x" });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/tbm", {
      method: "POST",
      body: JSON.stringify({ topic: "x" }),
    });
    createConfig.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "tbm-records"],
    });

    useUpdateTbmRecord();
    const updateConfig = useMutationMock.mock.calls[1][0] as MutationConfig<{
      id: string;
      data: { topic: string };
    }>;
    await updateConfig.mutationFn({ id: "tbm-2", data: { topic: "y" } });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/tbm/tbm-2", {
      method: "PUT",
      body: JSON.stringify({ topic: "y" }),
    });
    updateConfig.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "tbm-record"],
    });

    useDeleteTbmRecord();
    const deleteConfig = useMutationMock.mock
      .calls[2][0] as MutationConfig<string>;
    await deleteConfig.mutationFn("tbm-3");
    expect(apiFetchMock).toHaveBeenCalledWith("/education/tbm/tbm-3", {
      method: "DELETE",
    });
    deleteConfig.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "tbm-records"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "tbm-record"],
    });
  });
});
