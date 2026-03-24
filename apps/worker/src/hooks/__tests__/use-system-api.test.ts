import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useAnnouncements,
  useLeaveSite,
  usePoints,
  useProfile,
  useSiteInfo,
  useSystemStatus,
} from "@/hooks/use-system-api";
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

describe("use-system-api", () => {
  it("fetches system status with skipAuth option", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      success: true,
      data: { notices: [], hasIssues: false },
    });
    const { wrapper } = createWrapper();

    renderHook(() => useSystemStatus(), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/system/status", {
        skipAuth: true,
      });
    });
  });

  it("guards site info query until siteId exists", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { site: { id: "s1" } } });
    const { wrapper } = createWrapper();

    renderHook(() => useSiteInfo(null), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();

    renderHook(() => useSiteInfo("s1"), { wrapper });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/sites/s1");
    });
  });

  it("fetches profile and points", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: { user: { id: "u1" } } })
      .mockResolvedValueOnce({ data: { balance: 50, history: [] } });
    const { wrapper } = createWrapper();

    renderHook(() => useProfile(), { wrapper });
    renderHook(() => usePoints("site-p"), { wrapper });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/users/me");
      expect(apiFetch).toHaveBeenCalledWith("/points?siteId=site-p");
    });
  });

  it("guards announcements query until siteId exists and returns mapped data", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: [{ id: "a1" }] });
    const { wrapper } = createWrapper();

    const disabled = renderHook(() => useAnnouncements(""), { wrapper });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(disabled.result.current.data).toBeUndefined();

    const enabled = renderHook(() => useAnnouncements("site-a"), { wrapper });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/announcements?siteId=site-a");
      expect(enabled.result.current.data).toEqual([{ id: "a1" }]);
    });
  });

  it("leaves site and invalidates site/profile cache", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { message: "ok" } });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLeaveSite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ siteId: "site-1", reason: "퇴근" });
    });

    expect(apiFetch).toHaveBeenCalledWith("/sites/site-1/leave", {
      method: "POST",
      body: JSON.stringify({ reason: "퇴근" }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["site"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });
});
