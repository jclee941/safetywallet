import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostClassificationCard } from "../post-classification-card";
import {
  usePostClassification,
  useTriggerPostClassification,
} from "@/hooks/use-post-classification";

const mutateMock = vi.fn();

vi.mock("@/hooks/use-post-classification", () => ({
  usePostClassification: vi.fn(),
  useTriggerPostClassification: vi.fn(),
}));

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CardHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CardTitle: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CardDescription: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CardContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Badge: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <span data-class={className ?? ""}>{children}</span>,
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
  };
});

vi.mock("lucide-react", () => ({
  Bot: () => null,
  RefreshCw: () => null,
  Sparkles: () => null,
}));

const mockUsePostClassification = vi.mocked(usePostClassification);
const mockUseTriggerPostClassification = vi.mocked(
  useTriggerPostClassification,
);

const toPostClassificationResult = (
  value: unknown,
): ReturnType<typeof usePostClassification> => value as never;

const toTriggerResult = (
  value: unknown,
): ReturnType<typeof useTriggerPostClassification> => value as never;

describe("PostClassificationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTriggerPostClassification.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: false }),
    );
  });

  it("renders loading state", () => {
    mockUsePostClassification.mockReturnValue(
      toPostClassificationResult({ data: null, isLoading: true }),
    );

    render(<PostClassificationCard postId="post-1" />);
    expect(screen.getByText("분류 결과 로딩 중...")).toBeInTheDocument();
  });

  it("renders unclassified state and pending classify button", () => {
    mockUsePostClassification.mockReturnValue(
      toPostClassificationResult({
        data: { aiClassification: null, aiClassifiedAt: null },
        isLoading: false,
      }),
    );
    mockUseTriggerPostClassification.mockReturnValue(
      toTriggerResult({ mutate: mutateMock, isPending: true }),
    );

    render(<PostClassificationCard postId="post-1" />);

    expect(
      screen.getByText("아직 AI 분류가 수행되지 않았습니다."),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "분류 중..." });
    expect(button).toBeDisabled();
  });

  it("starts classification when button is clicked", () => {
    mockUsePostClassification.mockReturnValue(
      toPostClassificationResult({
        data: { aiClassification: null, aiClassifiedAt: null },
        isLoading: false,
      }),
    );

    render(<PostClassificationCard postId="post-99" />);
    fireEvent.click(screen.getByRole("button", { name: "AI 분류 시작" }));

    expect(mutateMock).toHaveBeenCalledWith("post-99");
  });

  it("renders classification result with known and fallback labels", () => {
    mockUsePostClassification.mockReturnValue(
      toPostClassificationResult({
        isLoading: false,
        data: {
          aiClassifiedAt: "2026-03-24T00:00:00.000Z",
          aiClassification: {
            suggestedCategory: "HAZARD",
            suggestedHazardType: "전도",
            suggestedHazardSubcategory: "FALL",
            suggestedRiskLevel: "HIGH",
            classificationReason: "사진에 난간 없음",
            keyFindings: ["난간 부재"],
            confidence: 0.87,
            modelVersion: "model-v3",
          },
        },
      }),
    );

    render(<PostClassificationCard postId="post-1" />);

    expect(screen.getByText("위험요소")).toBeInTheDocument();
    expect(screen.getByText("고위험")).toBeInTheDocument();
    expect(screen.getByText("신뢰도: 87%")).toBeInTheDocument();
    expect(screen.getByText("분류일시:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("위험유형")).toBeInTheDocument();
    expect(screen.getByText("전도")).toBeInTheDocument();
    expect(screen.getByText("위험 세부분류")).toBeInTheDocument();
    expect(screen.getByText("추락")).toBeInTheDocument();
    expect(screen.getByText("분류 근거")).toBeInTheDocument();
    expect(screen.getByText("사진에 난간 없음")).toBeInTheDocument();
    expect(screen.getByText("핵심 발견사항")).toBeInTheDocument();
    expect(screen.getByText("난간 부재")).toBeInTheDocument();
    expect(screen.getByText("model-v3")).toBeInTheDocument();
  });

  it("renders fallback values when labels are unknown and omits optional sections", () => {
    mockUsePostClassification.mockReturnValue(
      toPostClassificationResult({
        isLoading: false,
        data: {
          aiClassifiedAt: null,
          aiClassification: {
            suggestedCategory: "CUSTOM_CAT",
            suggestedHazardType: null,
            suggestedHazardSubcategory: "CUSTOM_SUB",
            suggestedRiskLevel: "CUSTOM_RISK",
            classificationReason: "사유",
            keyFindings: [],
            confidence: 0.1,
            modelVersion: "m1",
          },
        },
      }),
    );

    render(<PostClassificationCard postId="post-2" />);

    expect(screen.getByText("CUSTOM_CAT")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM_RISK")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM_SUB")).toBeInTheDocument();
    expect(
      screen.queryByText("분류일시:", { exact: false }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("위험유형")).not.toBeInTheDocument();
    expect(screen.queryByText("핵심 발견사항")).not.toBeInTheDocument();
  });
});
