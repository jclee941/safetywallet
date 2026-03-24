import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuditLogs } from "@/hooks/use-admin-audit-api";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
};

const useQueryMock = vi.fn<(config: QueryConfig) => unknown>();
const apiFetchMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: QueryConfig) => useQueryMock(config),
}));

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-admin-audit-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryMock.mockImplementation((config) => config);
  });

  it("loads audit logs from admin endpoint", async () => {
    apiFetchMock.mockResolvedValue({ logs: [{ id: "log-1" }] });
    useAuditLogs();
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toEqual(["admin", "audit"]);
    await expect(config.queryFn()).resolves.toEqual([{ id: "log-1" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/audit-logs?limit=100");
  });
});
