"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  apiFetch,
  type ApiResponse,
  type ActionDto,
  type UpdateActionStatusDto,
} from "./use-api-base";

export function useMyActions(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["actions", "my", params],
    queryFn: () =>
      apiFetch<ApiResponse<{ data: ActionDto[] }>>(
        `/actions/my${qs ? `?${qs}` : ""}`,
      ).then((r) => r.data),
  });
}

export function useAction(actionId: string | null) {
  return useQuery({
    queryKey: ["actions", actionId],
    queryFn: () => apiFetch<ApiResponse<ActionDto>>(`/actions/${actionId}`),
    enabled: !!actionId,
  });
}

export function useUpdateActionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      data,
    }: {
      actionId: string;
      data: UpdateActionStatusDto;
    }) =>
      apiFetch<ApiResponse<ActionDto>>(`/actions/${actionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        offlineQueue: true,
        offlineMutationType: "updateActionStatus",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}

export function useUploadActionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      formData,
    }: {
      actionId: string;
      formData: FormData;
    }) =>
      apiFetch<ApiResponse<{ id: string; fileUrl: string }>>(
        `/actions/${actionId}/images`,
        {
          method: "POST",
          body: formData,
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}

export function useDeleteActionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      imageId,
    }: {
      actionId: string;
      imageId: string;
    }) =>
      apiFetch<ApiResponse<null>>(`/actions/${actionId}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["actions", variables.actionId],
      });
    },
  });
}
