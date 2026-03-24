import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewAction, ReviewStatus } from "@safetywallet/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewActions } from "@/components/review-actions";

const mockReviewMutate = vi.fn();
const mockAdminReviewMutate = vi.fn();

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props} />
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
  };
});

vi.mock("lucide-react", () => ({
  Check: () => null,
  X: () => null,
  HelpCircle: () => null,
  AlertTriangle: () => null,
  Coins: () => null,
  ChevronDown: () => null,
}));

vi.mock("@/hooks/use-posts-api", () => ({
  useReviewPost: () => ({ mutate: mockReviewMutate, isPending: false }),
  useAdminReviewPost: () => ({
    mutate: mockAdminReviewMutate,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-points-api", () => ({
  usePolicies: () => ({ data: [] }),
}));

describe("ReviewActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves post with points and calls completion callback", async () => {
    const onComplete = vi.fn();
    mockAdminReviewMutate.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    render(<ReviewActions postId="post-1" onComplete={onComplete} />);

    // Step 1: Click "승인" to open points panel
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    // Step 2: Points panel shows with default 5 points
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /승인 \(5점 지급\)/ }),
      ).toBeInTheDocument();
    });

    // Step 3: Confirm approve with points
    fireEvent.click(screen.getByRole("button", { name: /승인 \(5점 지급\)/ }));

    await waitFor(() => {
      expect(mockAdminReviewMutate).toHaveBeenCalledWith(
        {
          postId: "post-1",
          action: "APPROVE",
          pointsToAward: 5,
          reasonCode: "POST_APPROVED",
        },
        expect.any(Object),
      );
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it("submits reject reason and comment", async () => {
    render(<ReviewActions postId="post-1" />);
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    fireEvent.click(screen.getByRole("button", { name: /중복 제보/ }));
    fireEvent.change(screen.getByPlaceholderText("추가 설명 (선택)"), {
      target: { value: "중복 확인" },
    });
    fireEvent.click(screen.getByRole("button", { name: "거절" }));

    await waitFor(() => {
      expect(mockAdminReviewMutate).toHaveBeenCalledWith(
        {
          postId: "post-1",
          action: "REJECT",
          comment: "중복 확인",
        },
        expect.any(Object),
      );
    });
  });

  it("requests more info and handles urgent flow", async () => {
    mockAdminReviewMutate.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    render(
      <ReviewActions postId="post-1" currentStatus={ReviewStatus.IN_REVIEW} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "추가 정보 요청" }));
    fireEvent.change(screen.getByPlaceholderText("필요한 정보를 입력하세요"), {
      target: { value: "작업 위치를 추가로 기입해주세요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));

    await waitFor(() => {
      expect(mockAdminReviewMutate).toHaveBeenCalledWith(
        {
          postId: "post-1",
          action: "REQUEST_MORE",
          comment: "작업 위치를 추가로 기입해주세요",
        },
        expect.any(Object),
      );
    });

    // Back to default view — click urgent
    fireEvent.click(screen.getByRole("button", { name: "긴급 지정" }));
    // Confirm in urgent panel
    fireEvent.click(screen.getByRole("button", { name: "긴급 지정" }));

    await waitFor(() => {
      expect(mockReviewMutate).toHaveBeenCalledWith(
        { postId: "post-1", action: ReviewAction.MARK_URGENT },
        expect.any(Object),
      );
    });
  });

  it("sets note from template when reject reason has template", () => {
    render(<ReviewActions postId="post-1" />);
    fireEvent.click(screen.getByRole("button", { name: "거절" }));

    // Click a reason with a template string ("사진 불명확" has template)
    fireEvent.click(screen.getByRole("button", { name: /사진 불명확/ }));

    // The note input should be populated with the template
    const noteInput = screen.getByPlaceholderText(
      "추가 설명 (선택)",
    ) as HTMLInputElement;
    expect(noteInput.value).toBeTruthy();
  });

  it("cancels reject flow", () => {
    render(<ReviewActions postId="post-1" />);
    fireEvent.click(screen.getByRole("button", { name: "거절" }));

    const cancelButton = screen.getByRole("button", { name: "취소" });
    fireEvent.click(cancelButton);

    // After cancel, should go back to main view with approve/reject buttons
    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
  });

  it("cancels points panel flow", async () => {
    render(<ReviewActions postId="post-1" />);
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /승인 \(5점 지급\)/ }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
  });

  it("cancels info request flow", () => {
    render(
      <ReviewActions postId="post-1" currentStatus={ReviewStatus.IN_REVIEW} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "추가 정보 요청" }));

    const cancelButton = screen.getByRole("button", { name: "취소" });
    fireEvent.click(cancelButton);

    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
  });

  it("cancels urgent confirm flow", async () => {
    mockAdminReviewMutate.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    render(
      <ReviewActions postId="post-1" currentStatus={ReviewStatus.IN_REVIEW} />,
    );
    // Go through info request to get to urgent flow
    fireEvent.click(screen.getByRole("button", { name: "추가 정보 요청" }));
    fireEvent.change(screen.getByPlaceholderText("필요한 정보를 입력하세요"), {
      target: { value: "테스트 요청 내용입니다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));

    await waitFor(() => {
      expect(mockAdminReviewMutate).toHaveBeenCalled();
    });

    // Now click urgent, then cancel
    fireEvent.click(screen.getByRole("button", { name: "긴급 지정" }));
    const cancelButton = screen.getByRole("button", { name: "취소" });
    fireEvent.click(cancelButton);

    expect(screen.getByRole("button", { name: "승인" })).toBeInTheDocument();
  });
});
