import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateEducationContent,
  useDeleteEducationContent,
  useEducationContent,
  useEducationContents,
  useUpdateEducationContent,
  useYouTubeOembed,
} from "@/hooks/use-education-contents-api";

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

describe("use-education-contents-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("builds contents list and single content queries with guards", async () => {
    apiFetchMock.mockResolvedValue({ contents: [] });
    useEducationContents({ limit: 10, offset: 5 });
    const listConfig = useQueryMock.mock.calls[0][0];
    expect(listConfig.queryKey).toEqual([
      "admin",
      "education-contents",
      "site-1",
      { limit: 10, offset: 5 },
    ]);
    expect(listConfig.enabled).toBe(true);
    await listConfig.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/contents?siteId=site-1&includeInactive=true&limit=10&offset=5",
    );

    apiFetchMock.mockResolvedValue({ id: "c1" });
    useEducationContent("c1");
    const detailConfig = useQueryMock.mock.calls[1][0];
    expect(detailConfig.queryKey).toEqual([
      "admin",
      "education-content",
      "site-1",
      "c1",
    ]);
    expect(detailConfig.enabled).toBe(true);
    await detailConfig.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/contents/c1");

    authState = { currentSiteId: null };
    useEducationContents();
    useEducationContent("");
    const noSiteList = useQueryMock.mock.calls[2][0];
    expect(noSiteList.enabled).toBe(false);
    await noSiteList.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/contents?includeInactive=true",
    );
    expect(useQueryMock.mock.calls[3][0].enabled).toBe(false);
  });

  it("handles create/youtube/delete/update mutations and invalidation", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateEducationContent();
    const createConfig = useMutationMock.mock.calls[0][0] as MutationConfig<{
      title: string;
    }>;
    await createConfig.mutationFn({ title: "new" });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/contents", {
      method: "POST",
      body: JSON.stringify({ title: "new" }),
    });
    createConfig.onSuccess?.();

    useYouTubeOembed();
    const oembedConfig = useMutationMock.mock
      .calls[1][0] as MutationConfig<string>;
    await oembedConfig.mutationFn("https://youtube.com/watch?v=abc 123");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/youtube-oembed?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dabc%20123",
    );

    useDeleteEducationContent();
    const deleteConfig = useMutationMock.mock
      .calls[2][0] as MutationConfig<string>;
    await deleteConfig.mutationFn("c2");
    expect(apiFetchMock).toHaveBeenCalledWith("/education/contents/c2", {
      method: "DELETE",
    });
    deleteConfig.onSuccess?.();

    useUpdateEducationContent();
    const updateConfig = useMutationMock.mock.calls[3][0] as MutationConfig<{
      id: string;
      data: { title: string };
    }>;
    await updateConfig.mutationFn({ id: "c3", data: { title: "updated" } });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/contents/c3", {
      method: "PATCH",
      body: JSON.stringify({ title: "updated" }),
    });
    updateConfig.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "education-contents"],
    });
  });
});
