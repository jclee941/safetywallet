import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Category } from "@safetywallet/types";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useCreatePost,
  usePost,
  usePosts,
  useResubmitPost,
} from "@/hooks/use-posts-api";
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

describe("use-posts-api", () => {
  it("fetches posts only when siteId is provided", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { posts: [] } });
    const { wrapper } = createWrapper();

    renderHook(() => usePosts(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    renderHook(() => usePosts("site-1"), { wrapper });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/posts?siteId=site-1");
    });
  });

  it("fetches a single post by id", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { post: { id: "p1" } } });
    const { wrapper } = createWrapper();

    renderHook(() => usePost("p1"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/posts/p1");
    });
  });

  it("creates a post with offline metadata and invalidates site posts", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("mutation-1");
    vi.mocked(apiFetch).mockResolvedValue({ data: { post: { id: "p1" } } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        siteId: "site-2",
        category: Category.HAZARD,
        content: "Test post",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/posts",
      expect.objectContaining({
        method: "POST",
        offlineQueue: true,
        offlineMutationType: "createPost",
        clientMutationId: "mutation-1",
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["posts", "site-2"],
    });
  });

  it("resubmits a post and invalidates post detail and list", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { post: { id: "p2" } } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useResubmitPost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        postId: "p2",
        supplementaryContent: "추가 설명",
      });
    });

    expect(apiFetch).toHaveBeenCalledWith("/posts/p2/resubmit", {
      method: "POST",
      body: JSON.stringify({ supplementaryContent: "추가 설명" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["post", "p2"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
  });
});
