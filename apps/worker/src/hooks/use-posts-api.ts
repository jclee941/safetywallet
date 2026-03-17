"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  apiFetch,
  type ApiResponse,
  type PostDto,
  type PostListDto,
  type CreatePostDto,
} from "./use-api-base";

export function usePosts(siteId: string) {
  return useQuery({
    queryKey: ["posts", siteId],
    queryFn: () =>
      apiFetch<ApiResponse<{ posts: PostListDto[] }>>(
        `/posts?siteId=${siteId}`,
      ),
    enabled: !!siteId,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: () => apiFetch<ApiResponse<{ post: PostDto }>>(`/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostDto) => {
      const clientMutationId = crypto.randomUUID();
      return apiFetch<ApiResponse<{ post: PostDto }>>("/posts", {
        method: "POST",
        body: JSON.stringify({ ...data, clientMutationId }),
        offlineQueue: true,
        offlineMutationType: "createPost",
        clientMutationId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts", variables.siteId] });
    },
  });
}

export function useResubmitPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      supplementaryContent,
    }: {
      postId: string;
      supplementaryContent: string;
    }) =>
      apiFetch<ApiResponse<{ post: PostDto }>>(`/posts/${postId}/resubmit`, {
        method: "POST",
        body: JSON.stringify({ supplementaryContent }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["post", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
