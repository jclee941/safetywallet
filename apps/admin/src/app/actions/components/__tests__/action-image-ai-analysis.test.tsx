import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionImageAiAnalysis } from "../action-image-ai-analysis";
import {
  useActionImageAiAnalysis,
  useTriggerActionImageAnalysis,
} from "@/hooks/use-action-ai-analysis";

const mutateMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/actions",
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="조치 이미지" {...props} />
  ),
}));

vi.mock("lucide-react", () => ({
  Bot: () => <span data-testid="icon-bot" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
}));

vi.mock("@/hooks/use-action-ai-analysis", () => ({
  useActionImageAiAnalysis: vi.fn(),
  useTriggerActionImageAnalysis: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-class={className ?? ""} data-variant={variant ?? ""}>
      {children}
    </span>
  ),
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

const mockUseActionImageAiAnalysis = vi.mocked(useActionImageAiAnalysis);
const mockUseTriggerActionImageAnalysis = vi.mocked(
  useTriggerActionImageAnalysis,
);

const toAnalysisResult = (
  value: unknown,
): ReturnType<typeof useActionImageAiAnalysis> => value as never;

const toTriggerResult = (
  value: unknown,
): ReturnType<typeof useTriggerActionImageAnalysis> => value as never;

describe("ActionImageAiAnalysis", () => {
  beforeEach(() => {
    mutateMock.mockReset();

    mockUseActionImageAiAnalysis.mockReturnValue(
      toAnalysisResult({ data: undefined, isLoading: false }),
    );
    mockUseTriggerActionImageAnalysis.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: false }),
    );
  });

  it("renders loading state and starts analysis", () => {
    mockUseActionImageAiAnalysis.mockReturnValueOnce(
      toAnalysisResult({ data: undefined, isLoading: true }),
    );

    render(
      <ActionImageAiAnalysis
        actionId="action-1"
        imageId="img-1"
        fileUrl="image.jpg"
        imageType="BEFORE"
      />,
    );

    expect(screen.getByText("개선 전")).toBeInTheDocument();
    expect(screen.getByText("분석 결과 로딩 중...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI 분석 시작" }));
    expect(mutateMock).toHaveBeenCalledWith({
      actionId: "action-1",
      imageId: "img-1",
    });
  });

  it("renders pending trigger state and empty-analysis message", () => {
    mockUseTriggerActionImageAnalysis.mockReturnValueOnce(
      toTriggerResult({ mutate: mutateMock, isPending: true }),
    );

    render(
      <ActionImageAiAnalysis
        actionId="action-2"
        imageId="img-2"
        fileUrl="image2.jpg"
        imageType={null}
      />,
    );

    expect(screen.getByText("분석 중...")).toBeInTheDocument();
    expect(
      screen.getByText("아직 AI 분석이 수행되지 않았습니다."),
    ).toBeInTheDocument();
  });

  it("renders full analysis details with list sections", () => {
    mockUseActionImageAiAnalysis.mockReturnValueOnce(
      toAnalysisResult({
        isLoading: false,
        data: {
          aiAnalyzedAt: "2026-01-10T03:00:00.000Z",
          aiAnalysis: {
            complianceStatus: "compliant",
            ppeDetected: ["안전모", "장갑"],
            ppeMissing: ["안전화"],
            safetyObservations: ["통로 정리 필요"],
            improvementAreas: ["표지판 보강"],
            beforeAfterComparison: "조치 후 상태가 개선되었습니다.",
            overallAssessment: "전반적으로 준수 상태입니다.",
            confidence: 92,
            modelVersion: "model-a1",
          },
        },
      }),
    );

    render(
      <ActionImageAiAnalysis
        actionId="action-3"
        imageId="img-3"
        fileUrl="image3.jpg"
        imageType="AFTER"
      />,
    );

    expect(screen.getByText("개선 후")).toBeInTheDocument();
    expect(screen.getByText(/분석일시:/)).toBeInTheDocument();
    expect(screen.getByText("준수")).toBeInTheDocument();
    expect(screen.getByText(/신뢰도: 92%/)).toBeInTheDocument();
    expect(screen.getByText("감지된 PPE")).toBeInTheDocument();
    expect(screen.getByText("안전모")).toBeInTheDocument();
    expect(screen.getByText("누락된 PPE")).toBeInTheDocument();
    expect(screen.getByText("안전화")).toBeInTheDocument();
    expect(screen.getByText("안전 관찰 사항")).toBeInTheDocument();
    expect(screen.getByText("개선 필요 영역")).toBeInTheDocument();
    expect(screen.getByText("개선 전후 비교")).toBeInTheDocument();
    expect(screen.getByText("종합 평가")).toBeInTheDocument();
    expect(screen.getByText("model-a1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mutateMock).toHaveBeenCalledWith({
      actionId: "action-3",
      imageId: "img-3",
    });
  });

  it("handles unknown image type/compliance and hides optional sections", () => {
    mockUseActionImageAiAnalysis.mockReturnValueOnce(
      toAnalysisResult({
        isLoading: false,
        data: {
          aiAnalyzedAt: null,
          aiAnalysis: {
            complianceStatus: "custom_status",
            ppeDetected: [],
            ppeMissing: [],
            safetyObservations: [],
            improvementAreas: [],
            beforeAfterComparison: null,
            overallAssessment: "요약",
            confidence: 55,
            modelVersion: "model-b1",
          },
        },
      }),
    );

    render(
      <ActionImageAiAnalysis
        actionId="action-4"
        imageId="img-4"
        fileUrl="image4.jpg"
        imageType={"CUSTOM" as "BEFORE" | "AFTER" | null}
      />,
    );

    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    expect(screen.queryByText("종합 평가")).not.toBeInTheDocument();
    expect(screen.queryByText("감지된 PPE")).not.toBeInTheDocument();
  });

  it("renders analysis with empty sections omitted but summary still visible", () => {
    mockUseActionImageAiAnalysis.mockReturnValueOnce(
      toAnalysisResult({
        isLoading: false,
        data: {
          aiAnalyzedAt: "2026-01-11T00:00:00.000Z",
          aiAnalysis: {
            complianceStatus: "partial",
            ppeDetected: [],
            ppeMissing: [],
            safetyObservations: [],
            improvementAreas: [],
            beforeAfterComparison: null,
            overallAssessment: "부분 개선",
            confidence: 70,
            modelVersion: "model-c1",
          },
        },
      }),
    );

    render(
      <ActionImageAiAnalysis
        actionId="action-5"
        imageId="img-5"
        fileUrl="image5.jpg"
        imageType="BEFORE"
      />,
    );

    expect(screen.getByText("부분 준수")).toBeInTheDocument();
    expect(screen.getByText("종합 평가")).toBeInTheDocument();
    expect(screen.getByText("부분 개선")).toBeInTheDocument();
    expect(screen.queryByText("감지된 PPE")).not.toBeInTheDocument();
    expect(screen.queryByText("누락된 PPE")).not.toBeInTheDocument();
    expect(screen.queryByText("개선 전후 비교")).not.toBeInTheDocument();
  });
});
