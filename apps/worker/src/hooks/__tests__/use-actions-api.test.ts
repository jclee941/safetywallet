import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ActionStatus } from "@safetywallet/types";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useAction,
  useDeleteActionImage,
  useMyActions,
  useUpdateActionStatus,
  useUploadActionImage,
} from "@/hooks/use-actions-api";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("use-actions-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds query string for useMyActions", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { data: [{ id: "a1" }] } });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMyActions({ status: "IN_PROGRESS", limit: 10, offset: 20 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/actions/my?status=IN_PROGRESS&limit=10&offset=20",
      );
      expect(result.current.data).toEqual({ data: [{ id: "a1" }] });
    });
  });

  it("calls /actions/my without query string when params are absent", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { data: [] } });
    const { wrapper } = createWrapper();

    renderHook(() => useMyActions(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/actions/my");
    });
  });

  it("guards useAction when actionId is null", () => {
    const { wrapper } = createWrapper();

    renderHook(() => useAction(null), { wrapper });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches action when actionId exists", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "a1" } });
    const { wrapper } = createWrapper();

    renderHook(() => useAction("a1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/actions/a1");
    });
  });

  it("updates action status and invalidates related queries", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { id: "a1" } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateActionStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        actionId: "a1",
        data: { actionStatus: ActionStatus.COMPLETED },
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/a1", {
      method: "PATCH",
      body: JSON.stringify({ actionStatus: ActionStatus.COMPLETED }),
      offlineQueue: true,
      offlineMutationType: "updateActionStatus",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["actions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["actions", "a1"] });
  });

  it("uploads and deletes action images, invalidating action detail", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { id: "img-1", fileUrl: "url" } })
      .mockResolvedValueOnce({ data: null });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const upload = renderHook(() => useUploadActionImage(), { wrapper });
    const remove = renderHook(() => useDeleteActionImage(), { wrapper });
    const formData = new FormData();
    formData.append("file", new Blob(["a"], { type: "text/plain" }), "a.txt");

    await act(async () => {
      await upload.result.current.mutateAsync({ actionId: "a1", formData });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/a1/images", {
      method: "POST",
      body: formData,
    });

    await act(async () => {
      await remove.result.current.mutateAsync({
        actionId: "a1",
        imageId: "img-1",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/actions/a1/images/img-1", {
      method: "DELETE",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["actions", "a1"] });
  });
});
