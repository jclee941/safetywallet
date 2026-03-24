import { fireEvent, render, screen } from "@testing-library/react";
import { ActionStatus, Category, ReviewStatus } from "@safetywallet/types";
import { describe, expect, it, vi } from "vitest";
import { PostContentCard } from "../post-content-card";

vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => (
    <img alt={props.alt} src={props.src} />
  ),
}));

vi.mock("@/components/review-actions", () => ({
  ReviewActions: (props: { postId: string }) => (
    <div data-testid="review-actions">review-{props.postId}</div>
  ),
}));

vi.mock("@/components/image-lightbox", () => ({
  ImageLightbox: (props: {
    images: string[];
    initialIndex: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <div data-testid="lightbox-state">
        {String(props.open)}:{props.initialIndex}:{props.images.join(",")}
      </div>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        close-lightbox
      </button>
    </div>
  ),
}));

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Badge: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <span data-testid="badge" data-class={className ?? ""}>
        {children}
      </span>
    ),
  };
});

vi.mock("lucide-react", () => ({
  MapPin: () => null,
  AlertTriangle: () => null,
  Clock: () => null,
  User: () => null,
  Image: () => null,
  MessageSquare: () => null,
}));

const fullPost = {
  id: "post-1",
  category: Category.HAZARD,
  content: "난간이 손상되었습니다",
  riskLevel: "HIGH",
  status: ReviewStatus.PENDING,
  actionStatus: ActionStatus.ASSIGNED,
  isUrgent: true,
  createdAt: "2026-03-24T00:00:00.000Z",
  locationFloor: "3",
  locationZone: "A구역",
  locationDetail: "계단",
  author: { id: "user-1", nameMasked: "김*수" },
  site: { id: "site-1", name: "현장A" },
  images: [
    {
      id: "img-1",
      fileUrl: "https://x/a.jpg",
      thumbnailUrl: "https://x/a_t.jpg",
    },
    { id: "img-2", fileUrl: "https://x/b.jpg" },
  ],
};

describe("PostContentCard", () => {
  it("renders full content, badges, images, and review actions", () => {
    render(
      <PostContentCard
        post={fullPost}
        postId="post-1"
        canReview
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "위험요소" }),
    ).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText(/조치:/)).toBeInTheDocument();
    expect(screen.getByText("현장A · 3층 · A구역 · 계단")).toBeInTheDocument();
    expect(screen.getByText("난간이 손상되었습니다")).toBeInTheDocument();
    expect(screen.getByText("첨부 사진 (2)")).toBeInTheDocument();
    expect(screen.getByTestId("review-actions")).toHaveTextContent(
      "review-post-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "첨부 2" }));
    expect(screen.getByTestId("lightbox-state")).toHaveTextContent(
      "true:1:https://x/a.jpg,https://x/b.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: "close-lightbox" }));
    expect(screen.getByTestId("lightbox-state")).toHaveTextContent(
      "false:1:https://x/a.jpg,https://x/b.jpg",
    );
  });

  it("renders fallback values and hides conditional sections when absent", () => {
    render(
      <PostContentCard
        post={{
          ...fullPost,
          category: "CUSTOM" as Category,
          status: "CUSTOM_STATUS" as ReviewStatus,
          actionStatus: ActionStatus.NONE,
          riskLevel: "CUSTOM_RISK",
          isUrgent: false,
          locationFloor: undefined,
          locationZone: undefined,
          locationDetail: undefined,
          site: undefined,
          images: [],
          author: { id: "user-2", nameMasked: "" },
        }}
        postId="post-2"
        canReview={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "CUSTOM" })).toBeInTheDocument();
    expect(screen.getByText("CUSTOM_STATUS")).toBeInTheDocument();
    expect(screen.getByText("익명")).toBeInTheDocument();
    expect(screen.queryByText("위치")).not.toBeInTheDocument();
    expect(screen.queryByText(/첨부 사진/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lightbox-state")).not.toBeInTheDocument();
  });
});
