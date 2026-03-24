import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Category, ReviewStatus } from "@safetywallet/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostDetailPage from "../post-detail";
import { useAdminPost, useDeleteAdminPost } from "@/hooks/use-api";

const { backMock, pushMock, toastMock, mutateMock } = vi.hoisted(() => ({
  backMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "post-1" }),
  useRouter: () => ({ back: backMock, push: pushMock }),
}));

vi.mock("@/hooks/use-api", () => ({
  useAdminPost: vi.fn(),
  useDeleteAdminPost: vi.fn(),
}));

vi.mock("../components/post-content-card", () => ({
  PostContentCard: ({
    canReview,
    onRefresh,
  }: {
    canReview: boolean;
    onRefresh: () => void;
  }) => (
    <div data-testid="post-content-card">
      canReview:{String(canReview)}
      <button type="button" onClick={onRefresh}>
        post-refresh
      </button>
    </div>
  ),
}));

vi.mock("../components/assignment-form", () => ({
  AssignmentForm: ({ onRefresh }: { onRefresh: () => void }) => (
    <div data-testid="assignment-form">
      <button type="button" onClick={onRefresh}>
        assignment-refresh
      </button>
    </div>
  ),
}));

vi.mock("../components/review-history-card", () => ({
  ReviewHistoryCard: () => <div data-testid="review-history-card" />,
}));

vi.mock("../components/metadata-card", () => ({
  MetadataCard: () => <div data-testid="metadata-card" />,
}));

vi.mock("../components/ai-analysis-card", () => ({
  AiAnalysisCard: () => <div data-testid="ai-analysis-card" />,
}));

vi.mock("../components/post-classification-card", () => ({
  PostClassificationCard: () => <div data-testid="post-classification-card" />,
}));

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
    Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="skeleton" {...props} />
    ),
    AlertDialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      open ? (
        <div>
          {children}
          <button type="button" onClick={() => onOpenChange?.(false)}>
            dialog-close
          </button>
        </div>
      ) : null,
    AlertDialogContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogCancel: (
      props: React.ButtonHTMLAttributes<HTMLButtonElement>,
    ) => <button type="button" {...props} />,
    AlertDialogAction: (
      props: React.ButtonHTMLAttributes<HTMLButtonElement>,
    ) => <button type="button" {...props} />,
    toast: toastMock,
  };
});

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  Trash2: () => null,
}));

const mockUseAdminPost = vi.mocked(useAdminPost);
const mockUseDeleteAdminPost = vi.mocked(useDeleteAdminPost);

const toAdminPostResult = (value: unknown): ReturnType<typeof useAdminPost> =>
  value as never;

const toDeletePostResult = (
  value: unknown,
): ReturnType<typeof useDeleteAdminPost> => value as never;

const basePost = {
  id: "post-1",
  category: Category.HAZARD,
  content: "난간 파손",
  status: ReviewStatus.PENDING,
  isUrgent: false,
  createdAt: "2026-03-20T00:00:00.000Z",
  author: { id: "user-1", nameMasked: "김*수" },
  reviews: [],
  metadata: { origin: "mobile" },
};

describe("PostDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDeleteAdminPost.mockReturnValue(
      toDeletePostResult({
        mutate: mutateMock,
        isPending: false,
      }),
    );
  });

  it("renders loading skeletons", () => {
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
  });

  it("renders not-found state and handles back navigation", () => {
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    expect(screen.getByText("제보를 찾을 수 없습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("renders cards and conditional sections for reviewable post", () => {
    const refetchMock = vi.fn();
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: basePost,
        isLoading: false,
        refetch: refetchMock,
      }),
    );

    render(<PostDetailPage />);

    expect(screen.getByText("제보 상세")).toBeInTheDocument();
    expect(screen.getByTestId("post-content-card")).toHaveTextContent(
      "canReview:true",
    );
    expect(screen.getByTestId("post-classification-card")).toBeInTheDocument();
    expect(screen.getByTestId("ai-analysis-card")).toBeInTheDocument();
    expect(screen.getByTestId("assignment-form")).toBeInTheDocument();
    expect(screen.getByTestId("review-history-card")).toBeInTheDocument();
    expect(screen.getByTestId("metadata-card")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "post-refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "assignment-refresh" }));
    expect(refetchMock).toHaveBeenCalledTimes(2);
  });

  it("hides assignment and metadata when not reviewable or metadata absent", () => {
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: {
          ...basePost,
          status: ReviewStatus.APPROVED,
          metadata: undefined,
        },
        isLoading: false,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    expect(screen.getByTestId("post-content-card")).toHaveTextContent(
      "canReview:false",
    );
    expect(screen.queryByTestId("assignment-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metadata-card")).not.toBeInTheDocument();
  });

  it("deletes post successfully and redirects", () => {
    mutateMock.mockImplementation(
      (
        _payload: unknown,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void },
      ) => {
        options?.onSuccess?.();
      },
    );

    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: basePost,
        isLoading: false,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[1]);

    expect(mutateMock).toHaveBeenCalledWith(
      {
        postId: "post-1",
        reason: "관리자 UI에서 제보 삭제",
      },
      expect.any(Object),
    );
    expect(toastMock).toHaveBeenCalledWith({
      description: "제보가 삭제되었습니다.",
    });
    expect(pushMock).toHaveBeenCalledWith("/posts");
  });

  it("shows deletion error toast on failure", () => {
    mutateMock.mockImplementation(
      (
        _payload: unknown,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void },
      ) => {
        options?.onError?.(new Error("네트워크 오류"));
      },
    );

    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: basePost,
        isLoading: false,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[1]);

    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      description: "삭제 실패: 네트워크 오류",
    });
  });

  it("disables delete action while pending", () => {
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: basePost,
        isLoading: false,
        refetch: vi.fn(),
      }),
    );
    mockUseDeleteAdminPost.mockReturnValue(
      toDeletePostResult({
        mutate: mutateMock,
        isPending: true,
      }),
    );

    render(<PostDetailPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    expect(screen.getAllByRole("button", { name: "삭제" })[1]).toBeDisabled();
  });

  it("supports top back button and dialog close", () => {
    mockUseAdminPost.mockReturnValue(
      toAdminPostResult({
        data: basePost,
        isLoading: false,
        refetch: vi.fn(),
      }),
    );

    render(<PostDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(backMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "dialog-close" }));
    expect(
      screen.queryByRole("button", { name: "dialog-close" }),
    ).not.toBeInTheDocument();
  });
});
