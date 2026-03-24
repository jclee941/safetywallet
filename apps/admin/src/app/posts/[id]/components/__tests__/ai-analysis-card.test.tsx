import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiAnalysisCard } from "../ai-analysis-card";
import { usePostAiAnalysis } from "@/hooks/use-ai-analysis";

vi.mock("@/hooks/use-ai-analysis", () => ({
  usePostAiAnalysis: vi.fn(),
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
    Skeleton: () => <div data-testid="skeleton" />,
  };
});

vi.mock("lucide-react", () => ({
  Brain: () => null,
  ShieldAlert: () => null,
  AlertTriangle: () => null,
  CheckCircle2: () => null,
  BookOpen: () => null,
}));

const mockUsePostAiAnalysis = vi.mocked(usePostAiAnalysis);

const toAiResult = (value: unknown): ReturnType<typeof usePostAiAnalysis> =>
  value as never;

describe("AiAnalysisCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton", () => {
    mockUsePostAiAnalysis.mockReturnValue(
      toAiResult({ data: null, isLoading: true, error: null }),
    );

    render(<AiAnalysisCard postId="post-1" />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("returns null for error/empty states", () => {
    mockUsePostAiAnalysis.mockReturnValue(
      toAiResult({ data: null, isLoading: false, error: new Error("err") }),
    );
    const { container, rerender } = render(<AiAnalysisCard postId="post-1" />);
    expect(container).toBeEmptyDOMElement();

    mockUsePostAiAnalysis.mockReturnValue(
      toAiResult({ data: { analyses: [] }, isLoading: false, error: null }),
    );
    rerender(<AiAnalysisCard postId="post-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders analysis data including fallback labels and conditional blocks", () => {
    mockUsePostAiAnalysis.mockReturnValue(
      toAiResult({
        isLoading: false,
        error: null,
        data: {
          analyses: [
            {
              filename: "photo-a.jpg",
              analysis: {
                severity: "critical",
                hazardType: "fall_hazard",
                description: "난간 누락",
                detectedObjects: ["ladder", "worker"],
                recommendations: ["난간 설치", "작업 중지"],
                relatedRegulations: ["산안법 제1조"],
                confidence: 0.91,
                modelVersion: "v1.2.3",
              },
            },
            {
              filename: "",
              analysis: {
                severity: "custom",
                hazardType: "unknown_type",
                description: "설명",
                detectedObjects: [],
                recommendations: [],
                relatedRegulations: [],
                confidence: 0.12,
                modelVersion: "",
              },
            },
          ],
        },
      }),
    );

    render(<AiAnalysisCard postId="post-1" />);

    expect(screen.getByText("🤖 AI 위험 분석")).toBeInTheDocument();
    expect(screen.getByText("심각")).toBeInTheDocument();
    expect(screen.getByText("추락 위험")).toBeInTheDocument();
    expect(screen.getByText("photo-a.jpg")).toBeInTheDocument();
    expect(screen.getByText("난간 누락")).toBeInTheDocument();
    expect(screen.getByText("ladder")).toBeInTheDocument();
    expect(screen.getByText("난간 설치")).toBeInTheDocument();
    expect(screen.getByText("관련 규정")).toBeInTheDocument();
    expect(screen.getByText("산안법 제1조")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();

    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.getByText("unknown_type")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
  });
});
