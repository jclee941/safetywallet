import { fireEvent, render, screen } from "@testing-library/react";
import { Category, RejectReason, ReviewStatus } from "@safetywallet/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewActions } from "../index";

const reviewMutate = vi.fn();
const adminReviewMutate = vi.fn();

vi.mock("@/hooks/use-posts-api", () => ({
  useReviewPost: vi.fn(),
  useAdminReviewPost: vi.fn(),
}));

vi.mock("@/hooks/use-points-api", () => ({
  usePolicies: vi.fn(),
}));

vi.mock("../action-buttons", () => ({
  ActionButtons: ({
    isPending,
    onApproveClick,
    onRejectClick,
    onInfoRequestClick,
    onUrgentClick,
  }: {
    isPending: boolean;
    onApproveClick: () => void;
    onRejectClick: () => void;
    onInfoRequestClick: () => void;
    onUrgentClick: () => void;
  }) => (
    <div>
      <div data-testid="pending-state">{String(isPending)}</div>
      <button type="button" onClick={onApproveClick}>
        open-approve
      </button>
      <button type="button" onClick={onRejectClick}>
        open-reject
      </button>
      <button type="button" onClick={onInfoRequestClick}>
        open-info
      </button>
      <button type="button" onClick={onUrgentClick}>
        open-urgent
      </button>
    </div>
  ),
}));

vi.mock("../points-panel", () => ({
  PointsPanel: ({
    pointsToAward,
    reasonCode,
    suggestedPoints,
    onPolicySelect,
    onPointsChange,
    onConfirm,
    onCancel,
  }: {
    pointsToAward: number;
    reasonCode: string;
    suggestedPoints: number;
    onPolicySelect: (id: string) => void;
    onPointsChange: (points: number) => void;
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <div data-testid="points-values">
        {pointsToAward}:{reasonCode}:{suggestedPoints}
      </div>
      <button type="button" onClick={() => onPolicySelect("p1")}>
        choose-policy
      </button>
      <button type="button" onClick={() => onPolicySelect("")}>
        choose-auto
      </button>
      <button type="button" onClick={() => onPointsChange(22)}>
        set-points
      </button>
      <button type="button" onClick={onConfirm}>
        confirm-approve
      </button>
      <button type="button" onClick={onCancel}>
        cancel-approve
      </button>
    </div>
  ),
}));

vi.mock("../reject-form", () => ({
  RejectForm: ({
    note,
    onReasonSelect,
    onNoteChange,
    onReject,
    onCancel,
  }: {
    note: string;
    onReasonSelect: (reason: RejectReason, template: string) => void;
    onNoteChange: (note: string) => void;
    onReject: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <div data-testid="reject-note">{note}</div>
      <button
        type="button"
        onClick={() => onReasonSelect(RejectReason.DUPLICATE, "중복입니다")}
      >
        pick-reason
      </button>
      <button
        type="button"
        onClick={() => onReasonSelect(RejectReason.OTHER, "")}
      >
        pick-other
      </button>
      <button type="button" onClick={() => onNoteChange("거절메모")}>
        set-note
      </button>
      <button type="button" onClick={onReject}>
        submit-reject
      </button>
      <button type="button" onClick={onCancel}>
        cancel-reject
      </button>
    </div>
  ),
}));

vi.mock("../info-request-form", () => ({
  InfoRequestForm: ({
    note,
    onNoteChange,
    onSubmit,
    onCancel,
  }: {
    note: string;
    onNoteChange: (note: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <div data-testid="info-note">{note}</div>
      <button type="button" onClick={() => onNoteChange("  ")}>
        set-empty-note
      </button>
      <button type="button" onClick={() => onNoteChange("추가정보")}>
        set-info-note
      </button>
      <button type="button" onClick={onSubmit}>
        submit-info
      </button>
      <button type="button" onClick={onCancel}>
        cancel-info
      </button>
    </div>
  ),
}));

vi.mock("../urgent-confirm", () => ({
  UrgentConfirm: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button type="button" onClick={onConfirm}>
        submit-urgent
      </button>
      <button type="button" onClick={onCancel}>
        cancel-urgent
      </button>
    </div>
  ),
}));

type MutationResult = {
  mutate: (
    payload: unknown,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void },
  ) => void;
  isPending: boolean;
};

let reviewMutationState: MutationResult;
let adminReviewMutationState: MutationResult;
let policiesState: {
  data: Array<{
    id: string;
    isActive: boolean;
    defaultAmount: number;
    reasonCode: string;
  }>;
};

describe("ReviewActions index", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    reviewMutate.mockReset();
    adminReviewMutate.mockReset();

    reviewMutationState = { mutate: reviewMutate, isPending: false };
    adminReviewMutationState = { mutate: adminReviewMutate, isPending: false };
    policiesState = {
      data: [
        { id: "p1", isActive: true, defaultAmount: 11, reasonCode: "RC1" },
        { id: "p2", isActive: false, defaultAmount: 22, reasonCode: "RC2" },
      ],
    };

    const postsHooks = await import("@/hooks/use-posts-api");
    const pointsHooks = await import("@/hooks/use-points-api");

    vi.mocked(postsHooks.useReviewPost).mockImplementation(
      () =>
        reviewMutationState as unknown as ReturnType<
          typeof postsHooks.useReviewPost
        >,
    );
    vi.mocked(postsHooks.useAdminReviewPost).mockImplementation(
      () =>
        adminReviewMutationState as unknown as ReturnType<
          typeof postsHooks.useAdminReviewPost
        >,
    );
    vi.mocked(pointsHooks.usePolicies).mockImplementation(
      () =>
        policiesState as unknown as ReturnType<typeof pointsHooks.usePolicies>,
    );
  });

  it("combines pending state and handles approve flow with points state transitions", () => {
    adminReviewMutationState.isPending = true;
    adminReviewMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    const onComplete = vi.fn();
    render(
      <ReviewActions
        postId="post-1"
        category={Category.HAZARD}
        riskLevel="HIGH"
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId("pending-state")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "open-approve" }));
    expect(screen.getByTestId("points-values")).toHaveTextContent(
      "15:POST_APPROVED:15",
    );

    fireEvent.click(screen.getByRole("button", { name: "choose-policy" }));
    expect(screen.getByTestId("points-values")).toHaveTextContent("11:RC1:15");

    fireEvent.click(screen.getByRole("button", { name: "choose-auto" }));
    expect(screen.getByTestId("points-values")).toHaveTextContent(
      "15:POST_APPROVED:15",
    );

    fireEvent.click(screen.getByRole("button", { name: "set-points" }));
    expect(screen.getByTestId("points-values")).toHaveTextContent(
      "22:POST_APPROVED:15",
    );

    fireEvent.click(screen.getByRole("button", { name: "confirm-approve" }));
    expect(adminReviewMutate).toHaveBeenCalledWith(
      {
        postId: "post-1",
        action: "APPROVE",
        pointsToAward: 22,
        reasonCode: "POST_APPROVED",
      },
      expect.any(Object),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "open-approve" }),
    ).toBeInTheDocument();
  });

  it("handles reject flow including early return without reason and cancel", () => {
    render(<ReviewActions postId="post-r" />);
    fireEvent.click(screen.getByRole("button", { name: "open-reject" }));

    fireEvent.click(screen.getByRole("button", { name: "submit-reject" }));
    expect(adminReviewMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "pick-reason" }));
    expect(screen.getByTestId("reject-note")).toHaveTextContent("중복입니다");
    fireEvent.click(screen.getByRole("button", { name: "pick-other" }));
    expect(screen.getByTestId("reject-note")).toHaveTextContent("중복입니다");
    fireEvent.click(screen.getByRole("button", { name: "set-note" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-reject" }));

    expect(adminReviewMutate).toHaveBeenCalledWith(
      {
        postId: "post-r",
        action: "REJECT",
        comment: "거절메모",
      },
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole("button", { name: "cancel-reject" }));
    expect(
      screen.getByRole("button", { name: "open-approve" }),
    ).toBeInTheDocument();
  });

  it("handles info request early-return, success reset, and cancel", () => {
    adminReviewMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    const onComplete = vi.fn();
    render(<ReviewActions postId="post-i" onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "open-info" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-info" }));
    expect(adminReviewMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "set-empty-note" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-info" }));
    expect(adminReviewMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "set-info-note" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-info" }));
    expect(adminReviewMutate).toHaveBeenCalledWith(
      {
        postId: "post-i",
        action: "REQUEST_MORE",
        comment: "추가정보",
      },
      expect.any(Object),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "open-approve" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-info" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel-info" }));
    expect(
      screen.getByRole("button", { name: "open-approve" }),
    ).toBeInTheDocument();
  });

  it("handles urgent flow confirm and cancel", () => {
    reviewMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    const onComplete = vi.fn();
    render(
      <ReviewActions
        postId="post-u"
        currentStatus={ReviewStatus.IN_REVIEW}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "open-urgent" }));
    fireEvent.click(screen.getByRole("button", { name: "submit-urgent" }));
    expect(reviewMutate).toHaveBeenCalledWith(
      { postId: "post-u", action: "MARK_URGENT" },
      expect.any(Object),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "open-urgent" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel-urgent" }));
    expect(
      screen.getByRole("button", { name: "open-approve" }),
    ).toBeInTheDocument();
  });
});
