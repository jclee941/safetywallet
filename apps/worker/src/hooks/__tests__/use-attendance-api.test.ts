import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAttendanceToday } from "@/hooks/use-attendance-api";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe("use-attendance-api", () => {
  it("does not fetch when siteId is null", () => {
    const { wrapper } = createWrapper();

    renderHook(() => useAttendanceToday(null), { wrapper });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("maps attendance response with first check-in record", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: {
        hasAttendance: true,
        records: [{ checkinAt: "2026-03-23T08:00:00.000Z" }],
      },
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAttendanceToday("site-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/attendance/today?siteId=site-1");
      expect(result.current.data).toEqual({
        attended: true,
        checkinAt: "2026-03-23T08:00:00.000Z",
      });
    });
  });

  it("maps missing records to null check-in", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: {
        hasAttendance: false,
        records: [],
      },
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAttendanceToday("site-2"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ attended: false, checkinAt: null });
    });
  });
});
