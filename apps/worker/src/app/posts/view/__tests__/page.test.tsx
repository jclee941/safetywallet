import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PostViewPage from "@/app/posts/view/page";
import { usePost, useResubmitPost } from "@/hooks/use-api";
import { setMockSearchParams, getMockRouter } from "@/__tests__/mocks";
import { Category, ReviewStatus } from "@safetywallet/types";

const toastMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  usePost: vi.fn(),
  useResubmitPost: vi.fn(),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@safetywallet/ui", async () => {
  const actual = await vi.importActual("@safetywallet/ui");
  return {
    ...actual,
    useToast: () => ({ toast: toastMock }),
  };
});

describe("app/posts/view/page", () => {
  it("renders loading state while post is fetching", () => {
    setMockSearchParams({ id: "p-loading" });
    vi.mocked(usePost).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<PostViewPage />);

    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("bottom-nav")).toBeInTheDocument();
  });

  it("renders not found state", () => {
    setMockSearchParams({ id: "p1" });
    vi.mocked(usePost).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("x"),
    } as never);
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<PostViewPage />);
    fireEvent.click(screen.getByRole("button", { name: "posts.view.back" }));
    expect(getMockRouter().back).toHaveBeenCalled();
  });

  it("renders detail and resubmits need-info post", async () => {
    setMockSearchParams({ id: "p1" });
    const mutate = vi.fn(
      (_payload: unknown, options: { onSuccess: () => void }) =>
        options.onSuccess(),
    );
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p1",
            category: "HAZARD",
            reviewStatus: "NEED_INFO",
            isUrgent: false,
            content: "상세 내용",
            createdAt: "2026-02-28T00:00:00Z",
            locationFloor: "3층",
            locationZone: "A",
            images: [],
            reviews: [
              { createdAt: "2026-02-28T01:00:00Z", comment: "추가 설명 필요" },
            ],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    render(<PostViewPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("posts.view.resubmitPlaceholder"),
      {
        target: { value: "보완 내용" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitSubmit" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalled();
    });
  });

  it("cancels resubmit form and renders mixed media with normalized r2 urls", async () => {
    setMockSearchParams({ id: "p-media" });
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-media",
            category: "HAZARD",
            reviewStatus: "NEED_INFO",
            isUrgent: false,
            content: "미디어 포함 게시글",
            createdAt: "2026-02-28T00:00:00Z",
            images: [
              {
                id: "img-1",
                fileUrl: "image/file-1.jpg",
                mediaType: "image",
              },
              {
                id: "vid-1",
                fileUrl: "/r2/video/file-1.mp4",
                mediaType: "video",
              },
            ],
            reviews: [{ createdAt: "2026-02-28T01:00:00Z", comment: "보완" }],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    const { container } = render(<PostViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("posts.view.resubmitPlaceholder"),
      { target: { value: "추가 설명" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitCancel" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("posts.view.resubmitPlaceholder"),
      ).not.toBeInTheDocument();
    });

    const image = container.querySelector("img[alt='posts.view.photo 1']");
    const video = container.querySelector("video");

    expect(image?.getAttribute("src")).toBe("/r2/image/file-1.jpg");
    expect(video?.getAttribute("src")).toBe("/r2/video/file-1.mp4");
  });

  it("renders rejected review details and reason fallback", () => {
    setMockSearchParams({ id: "p-rejected" });
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-rejected",
            category: Category.BEST_PRACTICE,
            reviewStatus: ReviewStatus.REJECTED,
            isUrgent: true,
            content: "반려된 게시글",
            createdAt: "2026-02-28T00:00:00Z",
            images: [],
            reviews: [
              {
                createdAt: "2026-02-28T00:00:00Z",
                reasonCode: "OTHER",
                comment: "초기 사유",
              },
              {
                createdAt: "2026-02-28T02:00:00Z",
                reasonCode: "UNKNOWN_REASON",
                comment: "최신 사유",
              },
            ],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    expect(screen.getByText("posts.category.bestPractice")).toBeInTheDocument();
    expect(screen.getByText("posts.view.urgent")).toBeInTheDocument();
    expect(
      screen.getByText("posts.view.rejectReasonTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN_REASON")).toBeInTheDocument();
    expect(screen.getByText("최신 사유")).toBeInTheDocument();
  });

  it("shows admin requested info fallback when need-info comment is missing", () => {
    setMockSearchParams({ id: "p-need-info" });
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-need-info",
            category: Category.HAZARD,
            reviewStatus: ReviewStatus.NEED_INFO,
            isUrgent: false,
            content: "보완 필요",
            createdAt: "2026-02-28T00:00:00Z",
            images: [],
            reviews: [{ createdAt: "2026-02-28T01:00:00Z" }],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    expect(
      screen.getByText("posts.view.adminRequestedInfo"),
    ).toBeInTheDocument();
  });

  it("uses fallback post shape and supports error description for failed resubmit", async () => {
    setMockSearchParams({ id: "p-fallback" });
    const mutate = vi.fn(
      (
        _payload: unknown,
        options: { onError: (err: Error) => void; onSuccess: () => void },
      ) => options.onError(new Error("resubmit failed")),
    );
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        post: {
          id: "p-fallback",
          category: Category.HAZARD,
          reviewStatus: ReviewStatus.REJECTED,
          isUrgent: false,
          content: "fallback shape",
          createdAt: "2026-02-28T00:00:00Z",
          images: [],
          reviews: [{ createdAt: "2026-02-28T01:00:00Z", comment: "사유" }],
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("posts.view.resubmitPlaceholder"),
      { target: { value: "보완 텍스트" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitSubmit" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "posts.view.resubmitError",
          description: "resubmit failed",
          variant: "destructive",
        }),
      );
    });
  });

  it("keeps resubmit submit button disabled for empty trimmed content", () => {
    setMockSearchParams({ id: "p-disabled" });
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-disabled",
            category: Category.HAZARD,
            reviewStatus: ReviewStatus.NEED_INFO,
            isUrgent: false,
            content: "disabled case",
            createdAt: "2026-02-28T00:00:00Z",
            images: [],
            reviews: [{ createdAt: "2026-02-28T01:00:00Z", comment: "보완" }],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("posts.view.resubmitPlaceholder"),
      { target: { value: "   " } },
    );

    expect(
      screen.getByRole("button", { name: "posts.view.resubmitSubmit" }),
    ).toBeDisabled();
  });

  it("returns early when resubmit is triggered with empty content", () => {
    setMockSearchParams({ id: "p-empty-submit" });
    const mutate = vi.fn();
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-empty-submit",
            category: Category.HAZARD,
            reviewStatus: ReviewStatus.NEED_INFO,
            isUrgent: false,
            content: "needs info",
            createdAt: "2026-02-28T00:00:00Z",
            images: [],
            reviews: [{ createdAt: "2026-02-28T01:00:00Z", comment: "보완" }],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    const submitButton = screen.getByRole("button", {
      name: "posts.view.resubmitSubmit",
    });
    submitButton.removeAttribute("disabled");
    fireEvent.click(submitButton);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns early when resubmit content is whitespace-only after trim", () => {
    setMockSearchParams({ id: "p-trim-empty" });
    const mutate = vi.fn();
    vi.mocked(useResubmitPost).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(usePost).mockReturnValue({
      data: {
        data: {
          post: {
            id: "p-trim-empty",
            category: Category.HAZARD,
            reviewStatus: ReviewStatus.NEED_INFO,
            isUrgent: false,
            content: "needs more",
            createdAt: "2026-02-28T00:00:00Z",
            images: [],
            reviews: [{ createdAt: "2026-02-28T01:00:00Z", comment: "보완" }],
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<PostViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.view.resubmitButton" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("posts.view.resubmitPlaceholder"),
      { target: { value: "\n\t  " } },
    );
    const submitButton = screen.getByRole("button", {
      name: "posts.view.resubmitSubmit",
    });
    submitButton.removeAttribute("disabled");
    fireEvent.click(submitButton);

    expect(mutate).not.toHaveBeenCalled();
  });
});
