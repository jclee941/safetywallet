import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerateQuizFromContent } from "@/hooks/use-quiz-generation";

type MutationConfig<TVariables> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onSuccess?: () => void;
};

const useMutationMock = vi.fn<(config: MutationConfig<string>) => unknown>();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));
const apiFetchMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: (config: MutationConfig<string>) => useMutationMock(config),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("use-quiz-generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMutationMock.mockImplementation((config) => config);
  });

  it("generates quiz from content and invalidates quizzes list", async () => {
    apiFetchMock.mockResolvedValue({ id: "q1", questions: [] });
    useGenerateQuizFromContent();
    const config = useMutationMock.mock.calls[0][0];

    await config.mutationFn("content-1");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/education/contents/content-1/generate-quiz",
      { method: "POST" },
    );

    config.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["admin", "education", "quizzes"],
    });
  });
});
