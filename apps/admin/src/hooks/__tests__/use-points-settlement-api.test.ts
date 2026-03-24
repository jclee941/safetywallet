import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateSettlementSnapshot,
  useFinalizeSettlement,
  useSettlementStatus,
} from "@/hooks/use-points-settlement-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

type MutationConfig = {
  mutationFn: () => Promise<unknown>;
  onSuccess?: () => void;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const useMutationMock = vi.fn<(config: MutationConfig) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

type AuthState = { currentSiteId: string | null };
let authState: AuthState = { currentSiteId: "site-1" };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
  useMutation: (config: MutationConfig) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector(authState),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-points-settlement-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { currentSiteId: "site-1" };
    useQueryMock.mockImplementation((config) => config);
    useMutationMock.mockImplementation((config) => config);
  });

  it("computes settlement status history and snapshot flags", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        entries: [
          {
            id: "e1",
            settleMonth: "2026-01",
            amount: 100,
            createdAt: "2026-01-10T00:00:00.000Z",
          },
          {
            id: "e2",
            amount: 30,
            occurredAt: "2026-01-15T00:00:00.000Z",
            createdAt: "2026-01-15T00:00:00.000Z",
          },
          {
            id: "e3",
            amount: 5,
            occurredAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "e4",
            amount: 10,
            occurredAt: "2025-12-01T00:00:00.000Z",
            createdAt: "2025-12-01T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ data: [{ id: "d1" }] });

    useSettlementStatus("2026-01");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual([
      "admin",
      "points",
      "settlement",
      "status",
      "site-1",
      "2026-01",
    ]);
    expect(config.enabled).toBe(true);

    const result = (await config.queryFn()) as {
      snapshotTaken: boolean;
      finalized: boolean;
      disputeOpenCount: number;
      history: Array<{
        month: string;
        totalAmount: number;
        entryCount: number;
        lastOccurredAt: string;
      }>;
    };
    expect(result.snapshotTaken).toBe(true);
    expect(result.finalized).toBe(false);
    expect(result.disputeOpenCount).toBe(1);
    expect(result.history[0].month).toBe("2026-01");
    expect(result.history[0].totalAmount).toBe(135);
    expect(result.history[0].entryCount).toBe(3);
    expect(result.history[0].lastOccurredAt).toBe("2026-01-15T00:00:00.000Z");
    expect(result.history[1].month).toBe("2025-12");
  });

  it("returns snapshotTaken false when requested month has no entries", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        entries: [
          {
            id: "e1",
            settleMonth: "2026-01",
            amount: 100,
            createdAt: "2026-01-10T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] });

    useSettlementStatus("2026-02");
    const config = useQueryMock.mock.calls[0][0];
    const result = (await config.queryFn()) as { snapshotTaken: boolean };
    expect(result.snapshotTaken).toBe(false);
  });

  it("disables query when no site and throws if queryFn is called", async () => {
    authState = { currentSiteId: null };
    useSettlementStatus("2026-01");
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(false);
    await expect(config.queryFn()).rejects.toThrow("현장 정보가 없습니다");
  });

  it("creates and finalizes settlement with invalidation", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });

    useCreateSettlementSnapshot();
    const create = useMutationMock.mock.calls[0][0];
    await create.mutationFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/settlements/snapshot", {
      method: "POST",
    });
    create.onSuccess?.();

    useFinalizeSettlement();
    const finalize = useMutationMock.mock.calls[1][0];
    await finalize.mutationFn();
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/settlements/finalize", {
      method: "POST",
    });
    finalize.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "points", "settlement"],
    });
  });
});
