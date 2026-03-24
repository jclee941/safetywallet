import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerateAnnouncementDraft } from "@/hooks/use-announcement-ai-draft";

type MutationConfig<TVariables> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
};

const useMutationMock =
  vi.fn<
    (config: MutationConfig<{ keywords: string; siteId: string }>) => unknown
  >();
const apiFetchMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: (config: MutationConfig<{ keywords: string; siteId: string }>) =>
    useMutationMock(config),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-announcement-ai-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMutationMock.mockImplementation((config) => config);
  });

  it("posts keywords and siteId to generate draft", async () => {
    apiFetchMock.mockResolvedValue({ title: "t", content: "c" });
    useGenerateAnnouncementDraft();
    const config = useMutationMock.mock.calls[0][0];

    await config.mutationFn({ keywords: "safe", siteId: "site-1" });
    expect(apiFetchMock).toHaveBeenCalledWith("/announcements/generate-draft", {
      method: "POST",
      body: JSON.stringify({ keywords: "safe", siteId: "site-1" }),
    });
  });
});
