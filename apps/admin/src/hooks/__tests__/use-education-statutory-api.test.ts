import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateStatutoryTraining,
  useDeleteStatutoryTraining,
  useStatutoryTrainings,
  useUpdateStatutoryTraining,
} from "@/hooks/use-education-statutory-api";

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

describe("use-education-statutory-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("builds statutory training query params and enabled state", async () => {
    apiFetchMock.mockResolvedValue({ trainings: [] });
    useStatutoryTrainings({
      userId: "u1",
      trainingType: "REGULAR",
      status: "COMPLETED",
      limit: 10,
      offset: 5,
    });
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "statutory-trainings",
      "site-1",
      {
        userId: "u1",
        trainingType: "REGULAR",
        status: "COMPLETED",
        limit: 10,
        offset: 5,
      },
    ]);
    expect(config.enabled).toBe(true);
    await config.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/statutory?siteId=site-1&userId=u1&trainingType=REGULAR&status=COMPLETED&limit=10&offset=5",
    );

    authState = { currentSiteId: null };
    useStatutoryTrainings();
    const noSiteConfig = useQueryMock.mock.calls[1][0];
    expect(noSiteConfig.enabled).toBe(false);
    await noSiteConfig.queryFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/education/statutory?");
  });

  it("creates, updates, and deletes statutory trainings", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateStatutoryTraining();
    const createConfig = useMutationMock.mock.calls[0][0] as MutationConfig<{
      trainingName: string;
    }>;
    await createConfig.mutationFn({ trainingName: "t1" });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/statutory", {
      method: "POST",
      body: JSON.stringify({ trainingName: "t1" }),
    });
    createConfig.onSuccess?.();

    useUpdateStatutoryTraining();
    const updateConfig = useMutationMock.mock.calls[1][0] as MutationConfig<{
      id: string;
      data: { trainingName: string };
    }>;
    await updateConfig.mutationFn({ id: "s1", data: { trainingName: "u" } });
    expect(apiFetchMock).toHaveBeenCalledWith("/education/statutory/s1", {
      method: "PUT",
      body: JSON.stringify({ trainingName: "u" }),
    });
    updateConfig.onSuccess?.();

    useDeleteStatutoryTraining();
    const deleteConfig = useMutationMock.mock
      .calls[2][0] as MutationConfig<string>;
    await deleteConfig.mutationFn("s2");
    expect(apiFetchMock).toHaveBeenCalledWith("/education/statutory/s2", {
      method: "DELETE",
    });
    deleteConfig.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "statutory-trainings"],
    });
  });
});
