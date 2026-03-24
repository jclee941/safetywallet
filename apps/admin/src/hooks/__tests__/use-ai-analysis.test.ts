import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostAiAnalysis } from "@/hooks/use-ai-analysis";
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

describe("use-ai-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("fetches post ai analysis when post and site are available", async () => {
    mockApiFetch.mockResolvedValue({
      analyses: [
        {
          imageUrl: "https://cdn/image.jpg",
          filename: "image.jpg",
          analysis: {
            hazardType: "FALL",
            severity: "HIGH",
            description: "Harness missing",
            recommendations: ["Wear harness"],
            detectedObjects: ["worker"],
            confidence: 0.91,
            relatedRegulations: ["KOSHA-1"],
            modelVersion: "v1",
          },
        },
      ],
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePostAiAnalysis("post-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/images/ai-analysis-by-post/post-1",
    );
    expect(result.current.data?.analyses).toHaveLength(1);
  });

  it("stays idle when post id or site id is missing", () => {
    const { wrapper } = createWrapper();

    const withoutPost = renderHook(() => usePostAiAnalysis(""), {
      wrapper,
    });
    expect(withoutPost.result.current.fetchStatus).toBe("idle");

    currentSiteId = null;
    const withoutSite = renderHook(() => usePostAiAnalysis("post-1"), {
      wrapper,
    });
    expect(withoutSite.result.current.fetchStatus).toBe("idle");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("returns query error when api call fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("analysis failed"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePostAiAnalysis("post-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("analysis failed");
  });
});
