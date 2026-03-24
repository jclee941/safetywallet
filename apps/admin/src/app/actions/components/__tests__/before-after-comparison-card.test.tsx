import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BeforeAfterComparisonCard } from "../before-after-comparison-card";
import {
  useBeforeAfterComparison,
  useTriggerBeforeAfterComparison,
} from "@/hooks/use-before-after-comparison";

const mutateMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/actions",
}));

vi.mock("lucide-react", () => ({
  Bot: () => <span data-testid="icon-bot" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
}));

vi.mock("@/hooks/use-before-after-comparison", () => ({
  useBeforeAfterComparison: vi.fn(),
  useTriggerBeforeAfterComparison: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <span data-class={className ?? ""}>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockUseBeforeAfterComparison = vi.mocked(useBeforeAfterComparison);
const mockUseTriggerBeforeAfterComparison = vi.mocked(
  useTriggerBeforeAfterComparison,
);

const toComparisonResult = (
  value: unknown,
): ReturnType<typeof useBeforeAfterComparison> => value as never;

const toTriggerResult = (
  value: unknown,
): ReturnType<typeof useTriggerBeforeAfterComparison> => value as never;

describe("BeforeAfterComparisonCard", () => {
  beforeEach(() => {
    mutateMock.mockReset();

    mockUseBeforeAfterComparison.mockReturnValue(
      toComparisonResult({ data: undefined, isLoading: false, isError: false }),
    );
    mockUseTriggerBeforeAfterComparison.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: false }),
    );
  });

  it("renders loading state", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({ data: undefined, isLoading: true, isError: false }),
    );

    render(<BeforeAfterComparisonCard actionId="action-1" />);

    expect(screen.getByText("개선 전후 AI 비교 분석")).toBeInTheDocument();
    expect(screen.getByText("분석 결과 로딩 중...")).toBeInTheDocument();
  });

  it("renders error state and handles pending/not-pending reanalysis", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({ data: undefined, isLoading: false, isError: true }),
    );

    const { rerender } = render(
      <BeforeAfterComparisonCard actionId="action-2" />,
    );

    expect(
      screen.getByText("비교 분석 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "재분석" }));
    expect(mutateMock).toHaveBeenCalledWith("action-2");

    mockUseBeforeAfterComparison.mockReturnValue(
      toComparisonResult({ data: undefined, isLoading: false, isError: true }),
    );
    mockUseTriggerBeforeAfterComparison.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: true }),
    );
    rerender(<BeforeAfterComparisonCard actionId="action-2" />);

    expect(screen.getByText("분석 중...")).toBeInTheDocument();
  });

  it("renders no-comparison state and handles trigger button branches", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({
        data: { comparison: null, comparedAt: null },
        isLoading: false,
        isError: false,
      }),
    );

    const { rerender } = render(
      <BeforeAfterComparisonCard actionId="action-3" />,
    );

    expect(
      screen.getByText(
        "BEFORE와 AFTER 이미지가 모두 있을 때 효과 분석이 가능합니다.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "비교 분석 시작" }));
    expect(mutateMock).toHaveBeenCalledWith("action-3");

    mockUseBeforeAfterComparison.mockReturnValue(
      toComparisonResult({
        data: { comparison: null, comparedAt: null },
        isLoading: false,
        isError: false,
      }),
    );
    mockUseTriggerBeforeAfterComparison.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: true }),
    );
    rerender(<BeforeAfterComparisonCard actionId="action-3" />);

    expect(screen.getByText("분석 중...")).toBeInTheDocument();
  });

  it("renders comparison result with empty change list and no remaining issues", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({
        isLoading: false,
        isError: false,
        data: {
          comparedAt: null,
          comparison: {
            overallImprovement: "MINIMAL",
            improvementScore: 45,
            beforeCondition: "개선 전 상태",
            afterCondition: "개선 후 상태",
            changesIdentified: [],
            remainingIssues: [],
            complianceImprovement: false,
            safetyRating: "FAIR",
            recommendation: "추가 점검 필요",
            confidence: 61,
            modelVersion: "compare-v1",
          },
        },
      }),
    );

    render(<BeforeAfterComparisonCard actionId="action-4" />);

    expect(screen.getByText("미미한 개선")).toBeInTheDocument();
    expect(screen.getByText("보통")).toBeInTheDocument();
    expect(screen.getByText(/개선 점수: 45%/)).toBeInTheDocument();
    expect(screen.getByText("확인된 변화가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("남은 안전 이슈")).not.toBeInTheDocument();
    expect(screen.getByText(/준수 수준 개선: 아니오/)).toBeInTheDocument();
    expect(screen.getByText(/신뢰도: 61%/)).toBeInTheDocument();
    expect(screen.getByText("compare-v1")).toBeInTheDocument();
  });

  it("renders comparison result with populated lists and comparedAt", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({
        isLoading: false,
        isError: false,
        data: {
          comparedAt: "2026-01-11T01:00:00.000Z",
          comparison: {
            overallImprovement: "SIGNIFICANT",
            improvementScore: 90,
            beforeCondition: "보호구 미착용",
            afterCondition: "보호구 착용 완료",
            changesIdentified: ["안전모 착용", "통로 정리"],
            remainingIssues: ["표지판 미흡"],
            complianceImprovement: true,
            safetyRating: "EXCELLENT",
            recommendation: "현재 상태 유지",
            confidence: 95,
            modelVersion: "compare-v2",
          },
        },
      }),
    );

    render(<BeforeAfterComparisonCard actionId="action-5" />);

    expect(screen.getByText("큰 폭 개선")).toBeInTheDocument();
    expect(screen.getByText("우수")).toBeInTheDocument();
    expect(screen.getByText("안전모 착용")).toBeInTheDocument();
    expect(screen.getByText("표지판 미흡")).toBeInTheDocument();
    expect(screen.getByText(/비교일시:/)).toBeInTheDocument();
    expect(screen.getByText(/준수 수준 개선: 예/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "재분석" }));
    expect(mutateMock).toHaveBeenCalledWith("action-5");
  });

  it("renders pending reanalysis button for comparison result", () => {
    mockUseBeforeAfterComparison.mockReturnValueOnce(
      toComparisonResult({
        isLoading: false,
        isError: false,
        data: {
          comparedAt: "2026-01-12T01:00:00.000Z",
          comparison: {
            overallImprovement: "MODERATE",
            improvementScore: 70,
            beforeCondition: "정리 전",
            afterCondition: "정리 후",
            changesIdentified: ["통로 개선"],
            remainingIssues: [],
            complianceImprovement: true,
            safetyRating: "GOOD",
            recommendation: "현재 수준 유지",
            confidence: 88,
            modelVersion: "compare-v3",
          },
        },
      }),
    );
    mockUseTriggerBeforeAfterComparison.mockReturnValueOnce(
      toTriggerResult({ mutate: mutateMock, isPending: true }),
    );

    render(<BeforeAfterComparisonCard actionId="action-6" />);

    expect(screen.getByText("분석 중...")).toBeInTheDocument();
  });
});
