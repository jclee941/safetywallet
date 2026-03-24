import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useTbmAiAnalysis,
  useTriggerTbmAiAnalysis,
} from "@/hooks/use-tbm-ai-analysis";
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

describe("use-tbm-ai-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("loads ai analysis for tbm records", async () => {
    mockApiFetch.mockResolvedValue({
      analysis: {
        summary: "analysis done",
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTbmAiAnalysis("tbm-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/education/tbm/tbm-1/ai-analysis",
    );
  });

  it("stays idle when tbm id or site id is missing", () => {
    const { wrapper } = createWrapper();

    const withoutTbmId = renderHook(() => useTbmAiAnalysis(null), { wrapper });
    expect(withoutTbmId.result.current.fetchStatus).toBe("idle");

    currentSiteId = null;
    const withoutSite = renderHook(() => useTbmAiAnalysis("tbm-1"), {
      wrapper,
    });
    expect(withoutSite.result.current.fetchStatus).toBe("idle");
  });

  it("triggers ai analysis and invalidates detail query", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerTbmAiAnalysis(), { wrapper });
    await result.current.mutateAsync("tbm-2");

    expect(mockApiFetch).toHaveBeenCalledWith("/education/tbm/tbm-2/analyze", {
      method: "POST",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "education", "tbm", "tbm-2", "ai-analysis"],
    });
  });

  it("returns mutation error when trigger request fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("trigger failed"));
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTriggerTbmAiAnalysis(), { wrapper });

    await expect(result.current.mutateAsync("tbm-3")).rejects.toThrow(
      "trigger failed",
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
