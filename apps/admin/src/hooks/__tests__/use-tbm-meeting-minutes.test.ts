import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useTbmMeetingMinutes,
  useTriggerTbmMeetingMinutes,
} from "@/hooks/use-tbm-meeting-minutes";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();
let currentSiteId: string | null = "site-1";

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => unknown,
  ) => selector({ currentSiteId }),
}));

describe("use-tbm-meeting-minutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("loads generated meeting minutes for a tbm", async () => {
    mockApiFetch.mockResolvedValue({
      minutes: {
        title: "TBM meeting",
      },
      generatedAt: "2026-03-01T00:00:00.000Z",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTbmMeetingMinutes("tbm-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/education/tbm/tbm-1/meeting-minutes",
    );
  });

  it("stays idle when tbm id or site id is missing", () => {
    const { wrapper } = createWrapper();

    const withoutTbmId = renderHook(() => useTbmMeetingMinutes(null), {
      wrapper,
    });
    expect(withoutTbmId.result.current.fetchStatus).toBe("idle");

    currentSiteId = null;
    const withoutSite = renderHook(() => useTbmMeetingMinutes("tbm-1"), {
      wrapper,
    });
    expect(withoutSite.result.current.fetchStatus).toBe("idle");
  });

  it("generates meeting minutes and invalidates minutes query", async () => {
    mockApiFetch.mockResolvedValue({
      success: true,
      minutes: { title: "new" },
    });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerTbmMeetingMinutes(), {
      wrapper,
    });
    await result.current.mutateAsync("tbm-2");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/education/tbm/tbm-2/generate-minutes",
      { method: "POST" },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "education", "tbm", "tbm-2", "meeting-minutes"],
    });
  });

  it("returns mutation error when generation fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("generation failed"));
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerTbmMeetingMinutes(), {
      wrapper,
    });

    await expect(result.current.mutateAsync("tbm-3")).rejects.toThrow(
      "generation failed",
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
