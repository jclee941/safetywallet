import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentForm } from "../assignment-form";
import { useCreateAction, useMembers, useReviewPost } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";

const createActionMutateAsync = vi.fn();
const reviewPostMutateAsync = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useMembers: vi.fn(),
  useCreateAction: vi.fn(),
  useReviewPost: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => (
      <select
        aria-label="select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <option value="">{placeholder}</option>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => <option value={value}>{children}</option>,
  };
});

vi.mock("lucide-react", () => ({
  UserPlus: () => null,
}));

const mockUseMembers = vi.mocked(useMembers);
const mockUseCreateAction = vi.mocked(useCreateAction);
const mockUseReviewPost = vi.mocked(useReviewPost);
const mockUseAuthStore = vi.mocked(useAuthStore);

const toMembersResult = (value: unknown): ReturnType<typeof useMembers> =>
  value as never;
const toCreateActionResult = (
  value: unknown,
): ReturnType<typeof useCreateAction> => value as never;
const toReviewPostResult = (value: unknown): ReturnType<typeof useReviewPost> =>
  value as never;

describe("AssignmentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createActionMutateAsync.mockResolvedValue(undefined);
    reviewPostMutateAsync.mockResolvedValue(undefined);

    mockUseAuthStore.mockReturnValue({ currentSiteId: "site-1" } as never);
    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: [
          { user: { id: "u1", name: "홍길동" } },
          { user: { id: "u2", name: "김민수" } },
        ],
      }),
    );
    mockUseCreateAction.mockReturnValue(
      toCreateActionResult({ mutateAsync: createActionMutateAsync }),
    );
    mockUseReviewPost.mockReturnValue(
      toReviewPostResult({ mutateAsync: reviewPostMutateAsync }),
    );
  });

  it("toggles assignment form and blocks submit when required fields are missing", () => {
    render(<AssignmentForm postId="post-1" onRefresh={vi.fn()} />);

    expect(screen.queryByText("담당자")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "배정하기" }));
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "시정조치 배정" }),
    ).toBeDisabled();
  });

  it("submits assignment and review successfully then resets state", async () => {
    const onRefresh = vi.fn();
    render(<AssignmentForm postId="post-1" onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "배정하기" }));

    const selects = screen.getAllByRole("combobox", { name: "select" });
    fireEvent.change(selects[0], { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText("마감일"), {
      target: { value: "2026-03-31" },
    });
    fireEvent.change(selects[1], { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("비고"), {
      target: { value: "안전펜스 설치" },
    });

    fireEvent.click(screen.getByRole("button", { name: "시정조치 배정" }));

    await waitFor(() => {
      expect(createActionMutateAsync).toHaveBeenCalledWith({
        postId: "post-1",
        assigneeId: "u1",
        dueDate: "2026-03-31",
        description: "안전펜스 설치",
        priority: "HIGH",
      });
      expect(reviewPostMutateAsync).toHaveBeenCalledWith({
        postId: "post-1",
        action: "ASSIGN",
        comment: "안전펜스 설치",
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("담당자")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "배정하기" }));
    expect(screen.getByLabelText("비고")).toHaveValue("");
  });

  it("sends undefined optional fields and handles mutation failure", async () => {
    createActionMutateAsync.mockRejectedValueOnce(new Error("fail"));

    render(<AssignmentForm postId="post-1" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "배정하기" }));

    const selects = screen.getAllByRole("combobox", { name: "select" });
    fireEvent.change(selects[0], { target: { value: "u2" } });
    fireEvent.change(screen.getByLabelText("마감일"), {
      target: { value: "2026-04-01" },
    });

    fireEvent.click(screen.getByRole("button", { name: "시정조치 배정" }));

    await waitFor(() => {
      expect(createActionMutateAsync).toHaveBeenCalledWith({
        postId: "post-1",
        assigneeId: "u2",
        dueDate: "2026-04-01",
        description: undefined,
        priority: undefined,
      });
    });
    expect(reviewPostMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "시정조치 배정" })).toBeEnabled();
  });
});
