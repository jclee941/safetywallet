import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useActionItems,
  useCreateAction,
  useUpdateAction,
} from "@/hooks/use-actions-api";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();
let currentSiteId: string | null = "site-1";

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => unknown,
  ) => selector({ currentSiteId }),
}));

describe("use-actions-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("fetches action items by current site", async () => {
    mockApiFetch.mockResolvedValue({
      data: [{ id: "a1" }],
      pagination: { limit: 20, offset: 0, count: 1 },
    });
    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "a1" }]);
    expect(mockApiFetch).toHaveBeenCalledWith("/actions?siteId=site-1");
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["admin", "actions", "site-1"] }),
    ).toBeDefined();
  });

  it("returns action items when api response is already an array", async () => {
    mockApiFetch.mockResolvedValue([{ id: "a-array-1" }, { id: "a-array-2" }]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: "a-array-1" },
      { id: "a-array-2" },
    ]);
  });

  it("returns empty list when response object has no data field", async () => {
    mockApiFetch.mockResolvedValue({});
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useActionItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("creates action and invalidates post queries", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAction(), { wrapper });
    await result.current.mutateAsync({
      postId: "post-1",
      assigneeId: "member-1",
      dueDate: "2026-02-16",
      description: "즉시 조치",
      priority: "HIGH",
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/actions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "posts"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "post"] });
  });

  it("updates action status and invalidates action queries", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateAction(), { wrapper });
    await result.current.mutateAsync({
      id: "action-1",
      status: "COMPLETED",
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/actions/action-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "actions"],
    });
  });
});
