import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateIssue,
  useIssues,
  useIssueTemplates,
} from "@/hooks/use-issues-api";
import { createWrapper } from "./test-utils";

const mockApiFetch = vi.fn();

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const baseIssue = {
  number: 1,
  title: "Issue title",
  body: "details",
  state: "open",
  labels: [],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
  html_url: "https://example.com/1",
  user: { login: "user", avatar_url: "https://example.com/avatar.png" },
};

describe("use-issues-api hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns issues list from apiFetch data", async () => {
    mockApiFetch.mockResolvedValueOnce([baseIssue]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useIssues("open"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([baseIssue]);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/issues?state=open&per_page=50",
    );
  });

  it("uses default state filter when omitted", async () => {
    mockApiFetch.mockResolvedValueOnce([baseIssue]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useIssues(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/issues?state=open&per_page=50",
    );
  });

  it("creates issue and invalidates cache", async () => {
    mockApiFetch.mockResolvedValueOnce(baseIssue);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateIssue(), { wrapper });

    await result.current.mutateAsync({ title: "New issue", assignCodex: true });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/issues",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New issue", assignCodex: true }),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "issues"],
    });
  });

  it("fetches issue templates", async () => {
    const templates = [
      {
        slug: "bug",
        name: "버그",
        labels: ["bug"],
        fields: [],
      },
    ];
    mockApiFetch.mockResolvedValueOnce(templates);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useIssueTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(templates);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/issues/templates");
  });
});
