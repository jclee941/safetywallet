import {
  ActionStatus,
  Category,
  ReviewStatus,
  RiskLevel,
} from "@safetywallet/types";
import { describe, expect, it } from "vitest";
import {
  actionStatusColors,
  actionStatusLabels,
  buildLocationString,
  canReviewPost,
  categoryLabels,
  reviewActionLabels,
  riskLabels,
  statusColors,
  statusLabels,
} from "../post-detail-helpers";

describe("post-detail-helpers", () => {
  it("exposes all status/category/action labels and colors", () => {
    expect(statusLabels[ReviewStatus.PENDING]).toBe("접수됨");
    expect(statusLabels[ReviewStatus.IN_REVIEW]).toBe("검토 중");
    expect(statusLabels[ReviewStatus.NEED_INFO]).toBe("추가정보 필요");
    expect(statusLabels[ReviewStatus.APPROVED]).toBe("승인됨");
    expect(statusLabels[ReviewStatus.REJECTED]).toBe("거절됨");
    expect(statusLabels[ReviewStatus.URGENT]).toBe("긴급");

    expect(statusColors[ReviewStatus.PENDING]).toContain("blue");
    expect(statusColors[ReviewStatus.IN_REVIEW]).toContain("yellow");
    expect(statusColors[ReviewStatus.NEED_INFO]).toContain("orange");
    expect(statusColors[ReviewStatus.APPROVED]).toContain("green");
    expect(statusColors[ReviewStatus.REJECTED]).toContain("red");
    expect(statusColors[ReviewStatus.URGENT]).toContain("font-semibold");

    expect(categoryLabels[Category.HAZARD]).toBe("위험요소");
    expect(categoryLabels[Category.UNSAFE_BEHAVIOR]).toBe("불안전 행동");
    expect(categoryLabels[Category.INCONVENIENCE]).toBe("불편사항");
    expect(categoryLabels[Category.SUGGESTION]).toBe("개선 제안");
    expect(categoryLabels[Category.BEST_PRACTICE]).toBe("모범 사례");

    expect(riskLabels[RiskLevel.HIGH]).toEqual({
      label: "높음",
      color: "bg-red-100 text-red-800",
    });
    expect(riskLabels[RiskLevel.MEDIUM]).toEqual({
      label: "보통",
      color: "bg-yellow-100 text-yellow-800",
    });
    expect(riskLabels[RiskLevel.LOW]).toEqual({
      label: "낮음",
      color: "bg-green-100 text-green-800",
    });

    expect(reviewActionLabels.APPROVE).toBe("승인");
    expect(reviewActionLabels.REJECT).toBe("거절");
    expect(reviewActionLabels.REQUEST_MORE).toBe("추가정보 요청");
    expect(reviewActionLabels.MARK_URGENT).toBe("긴급 지정");
    expect(reviewActionLabels.ASSIGN).toBe("시정조치 배정");
    expect(reviewActionLabels.CLOSE).toBe("종결");

    expect(actionStatusLabels[ActionStatus.NONE]).toBe("없음");
    expect(actionStatusLabels[ActionStatus.ASSIGNED]).toBe("배정됨");
    expect(actionStatusLabels[ActionStatus.IN_PROGRESS]).toBe("진행 중");
    expect(actionStatusLabels[ActionStatus.COMPLETED]).toBe("완료");
    expect(actionStatusLabels[ActionStatus.VERIFIED]).toBe("확인됨");
    expect(actionStatusLabels[ActionStatus.OVERDUE]).toBe("기한초과");

    expect(actionStatusColors[ActionStatus.NONE]).toBe("");
    expect(actionStatusColors[ActionStatus.ASSIGNED]).toContain("blue");
    expect(actionStatusColors[ActionStatus.IN_PROGRESS]).toContain("yellow");
    expect(actionStatusColors[ActionStatus.COMPLETED]).toContain("green");
    expect(actionStatusColors[ActionStatus.VERIFIED]).toContain("emerald");
    expect(actionStatusColors[ActionStatus.OVERDUE]).toContain("font-semibold");
  });

  it("builds location strings from optional segments", () => {
    expect(buildLocationString({})).toBe("");
    expect(buildLocationString({ locationFloor: "3" })).toBe("3층");
    expect(buildLocationString({ locationZone: "A" })).toBe("A");
    expect(
      buildLocationString({
        locationFloor: "2",
        locationZone: "B동",
        locationDetail: "계단실",
      }),
    ).toBe("2층 · B동 · 계단실");
  });

  it("allows review only for pending/in-review/need-info statuses", () => {
    expect(canReviewPost(ReviewStatus.PENDING)).toBe(true);
    expect(canReviewPost(ReviewStatus.IN_REVIEW)).toBe(true);
    expect(canReviewPost(ReviewStatus.NEED_INFO)).toBe(true);
    expect(canReviewPost(ReviewStatus.APPROVED)).toBe(false);
    expect(canReviewPost(ReviewStatus.REJECTED)).toBe(false);
    expect(canReviewPost(ReviewStatus.URGENT)).toBe(false);
  });
});
