import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAiAnalysis } from "../contents-tab/content-ai-analysis";
import { ContentFormFields } from "../contents-tab/content-form-fields";
import { KoshaSection } from "../contents-tab/content-form-kosha";
import { SourceModeButtons } from "../contents-tab/content-form-source-modes";
import { ContentForm } from "../contents-tab/content-form";
import { ContentList } from "../contents-tab/content-list";
import {
  useCreateEducationContent,
  useDeleteEducationContent,
  useUpdateEducationContent,
  useYouTubeOembed,
} from "@/hooks/use-api";
import { useEducationCompletions } from "@/hooks/use-education-completions";
import { useGenerateQuizFromContent } from "@/hooks/use-quiz-generation";
import {
  useEducationAiAnalysis,
  useTriggerEducationAiAnalysis,
} from "@/hooks/use-education-ai-analysis";

const toastMock = vi.fn();
const createAsyncMock = vi.fn();
const updateAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();
const oembedAsyncMock = vi.fn();
const generateQuizAsyncMock = vi.fn();
const triggerAiMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useCreateEducationContent: vi.fn(),
  useUpdateEducationContent: vi.fn(),
  useDeleteEducationContent: vi.fn(),
  useYouTubeOembed: vi.fn(),
}));

vi.mock("@/hooks/use-education-completions", () => ({
  useEducationCompletions: vi.fn(),
}));

vi.mock("@/hooks/use-quiz-generation", () => ({
  useGenerateQuizFromContent: vi.fn(),
}));

vi.mock("@/hooks/use-education-ai-analysis", () => ({
  useEducationAiAnalysis: vi.fn(),
  useTriggerEducationAiAnalysis: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    columns,
    data,
    emptyMessage,
  }: {
    columns: Array<{
      key: string;
      header: string;
      render?: (item: Record<string, unknown>) => ReactNode;
    }>;
    data: Array<Record<string, unknown>>;
    emptyMessage?: string;
  }) => (
    <div>
      <p>{emptyMessage}</p>
      {data.map((item, rowIdx) => (
        <div key={String(item.id ?? rowIdx)}>
          {columns.map((column) => (
            <div key={`${String(item.id ?? rowIdx)}-${column.key}`}>
              {column.render
                ? column.render(item)
                : String(item[column.key] ?? "")}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open === false ? null : (
      <div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          dialog-close
        </button>
        {children}
      </div>
    ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open === false ? null : (
      <div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          alert-close
        </button>
        {children}
      </div>
    ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h3>{children}</h3>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  useToast: () => ({ toast: toastMock }),
}));

const mockUseCreateEducationContent = vi.mocked(useCreateEducationContent);
const mockUseUpdateEducationContent = vi.mocked(useUpdateEducationContent);
const mockUseDeleteEducationContent = vi.mocked(useDeleteEducationContent);
const mockUseYouTubeOembed = vi.mocked(useYouTubeOembed);
const mockUseEducationCompletions = vi.mocked(useEducationCompletions);
const mockUseGenerateQuizFromContent = vi.mocked(useGenerateQuizFromContent);
const mockUseEducationAiAnalysis = vi.mocked(useEducationAiAnalysis);
const mockUseTriggerEducationAiAnalysis = vi.mocked(
  useTriggerEducationAiAnalysis,
);

describe("content ai analysis", () => {
  beforeEach(() => {
    triggerAiMock.mockReset();
    mockUseTriggerEducationAiAnalysis.mockReturnValue({
      mutate: triggerAiMock,
      isPending: false,
    } as never);
  });

  it("returns null for VIDEO type", () => {
    mockUseEducationAiAnalysis.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);
    const { container } = render(
      <ContentAiAnalysis contentId="c1" contentType="VIDEO" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders loading and empty states and triggers analyze", () => {
    mockUseEducationAiAnalysis.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as never);
    const { rerender } = render(
      <ContentAiAnalysis contentId="c1" contentType="TEXT" />,
    );
    expect(screen.getByText("분석 결과 로딩 중...")).toBeInTheDocument();

    mockUseEducationAiAnalysis.mockReturnValueOnce({
      data: { analysis: null, analyzedAt: null },
      isLoading: false,
    } as never);
    rerender(<ContentAiAnalysis contentId="c1" contentType="TEXT" />);
    fireEvent.click(screen.getByRole("button", { name: "AI 분석 시작" }));
    expect(triggerAiMock).toHaveBeenCalledWith("c1");
  });

  it("renders analyzed data including fallback labels", () => {
    mockUseEducationAiAnalysis.mockReturnValue({
      isLoading: false,
      data: {
        analyzedAt: "2026-02-01T01:00:00.000Z",
        analysis: {
          qualityLevel: "unknown_quality",
          category: "unknown_category",
          confidence: 0.78,
          summary: "요약",
          keyLearningPoints: ["학습1"],
          safetyRelevance: "높음",
          relatedStatutoryTraining: ["정기교육"],
          improvements: ["개선1"],
          targetAudience: "신규자",
          modelVersion: "model-v1",
        },
      },
    } as never);

    render(<ContentAiAnalysis contentId="c1" contentType="TEXT" />);
    expect(screen.getAllByText("요약").length).toBeGreaterThan(0);
    expect(screen.getByText("unknown_quality")).toBeInTheDocument();
    expect(screen.getByText("unknown_category")).toBeInTheDocument();
    expect(screen.getByText(/신뢰도: 78%/)).toBeInTheDocument();
    expect(screen.getByText("model-v1")).toBeInTheDocument();
  });
});

describe("content form helpers", () => {
  it("updates content form fields", () => {
    const onContentFormChange = vi.fn();
    render(
      <ContentFormFields
        contentForm={{
          title: "",
          contentType: "VIDEO",
          description: "",
          contentUrl: "",
          thumbnailUrl: "",
          durationMinutes: "",
          externalSource: "LOCAL",
          externalId: "",
          sourceUrl: "",
        }}
        onContentFormChange={onContentFormChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "제목1" },
    });
    fireEvent.change(screen.getByPlaceholderText("설명"), {
      target: { value: "설명1" },
    });
    fireEvent.change(screen.getByPlaceholderText("콘텐츠 URL"), {
      target: { value: "/r2/file" },
    });
    fireEvent.change(screen.getByPlaceholderText("썸네일 URL"), {
      target: { value: "https://example.com/thumb.jpg" },
    });
    fireEvent.change(screen.getByPlaceholderText("재생 시간(분)"), {
      target: { value: "8" },
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "TEXT" } });

    expect(onContentFormChange).toHaveBeenCalled();
  });

  it("supports kosha url and source mode buttons", () => {
    const onSourceUrlChange = vi.fn();
    const onSetMode = vi.fn();

    render(
      <>
        <KoshaSection sourceUrl="" onSourceUrlChange={onSourceUrlChange} />
        <SourceModeButtons sourceMode="LOCAL" onSetMode={onSetMode} />
      </>,
    );

    fireEvent.change(screen.getByPlaceholderText("KOSHA URL"), {
      target: { value: "https://kosha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    fireEvent.click(screen.getByRole("button", { name: "🏛️ KOSHA" }));
    fireEvent.click(screen.getByRole("button", { name: "📝 직접 입력" }));

    expect(onSourceUrlChange).toHaveBeenCalledWith("https://kosha");
    expect(onSetMode).toHaveBeenCalledWith("YOUTUBE");
    expect(onSetMode).toHaveBeenCalledWith("KOSHA");
    expect(onSetMode).toHaveBeenCalledWith("LOCAL");
  });

  it("covers all content type selections and numeric field updates", () => {
    const onContentFormChange = vi.fn();

    render(
      <ContentFormFields
        contentForm={{
          title: "기본 제목",
          contentType: "VIDEO",
          description: "",
          contentUrl: "",
          thumbnailUrl: "",
          durationMinutes: "",
          externalSource: "LOCAL",
          externalId: "",
          sourceUrl: "",
        }}
        onContentFormChange={onContentFormChange}
      />,
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "VIDEO" } });
    fireEvent.change(select, { target: { value: "IMAGE" } });
    fireEvent.change(select, { target: { value: "TEXT" } });
    fireEvent.change(select, { target: { value: "DOCUMENT" } });

    fireEvent.change(screen.getByPlaceholderText("재생 시간(분)"), {
      target: { value: "15" },
    });

    expect(onContentFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "VIDEO" }),
    );
    expect(onContentFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "IMAGE" }),
    );
    expect(onContentFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "TEXT" }),
    );
    expect(onContentFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "DOCUMENT" }),
    );
    expect(onContentFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ durationMinutes: "15" }),
    );
  });
});

describe("content form and list", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createAsyncMock.mockReset();
    updateAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    oembedAsyncMock.mockReset();
    generateQuizAsyncMock.mockReset();

    mockUseCreateEducationContent.mockReturnValue({
      mutateAsync: createAsyncMock,
      isPending: false,
    } as never);
    mockUseUpdateEducationContent.mockReturnValue({
      mutateAsync: updateAsyncMock,
      isPending: false,
    } as never);
    mockUseDeleteEducationContent.mockReturnValue({
      mutateAsync: deleteAsyncMock,
      isPending: false,
    } as never);
    mockUseYouTubeOembed.mockReturnValue({
      mutateAsync: oembedAsyncMock,
      isPending: false,
    } as never);
    mockUseGenerateQuizFromContent.mockReturnValue({
      mutateAsync: generateQuizAsyncMock,
      isPending: false,
    } as never);
    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, total: 0, limit: 20, totalPages: 0 },
      },
      isLoading: false,
    } as never);
    mockUseEducationAiAnalysis.mockReturnValue({
      data: { analysis: null, analyzedAt: null },
      isLoading: false,
    } as never);
    mockUseTriggerEducationAiAnalysis.mockReturnValue({
      mutate: triggerAiMock,
      isPending: false,
    } as never);
  });

  it("creates content and handles youtube empty-url validation", async () => {
    render(<ContentForm />);

    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "새 콘텐츠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "교육자료 등록" }));

    await waitFor(() => {
      expect(createAsyncMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    fireEvent.click(screen.getByRole("button", { name: "정보 가져오기" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("updates content in edit mode and supports cancel", async () => {
    const onCancelEdit = vi.fn();
    render(
      <ContentForm
        editingContentId="c1"
        contents={[
          {
            id: "c1",
            title: "기존",
            contentType: "VIDEO",
            externalSource: "YOUTUBE",
            contentUrl: "https://youtu.be/abc",
            sourceUrl: "https://youtu.be/abc",
            createdAt: "2026-01-01",
          },
        ]}
        onCancelEdit={onCancelEdit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "수정 콘텐츠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "교육 콘텐츠 수정" }));
    await waitFor(() => {
      expect(updateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c1" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it("covers mode switching, kosha URL change, and create failure", async () => {
    createAsyncMock.mockRejectedValueOnce(new Error("create failed"));

    render(<ContentForm />);

    fireEvent.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    fireEvent.change(screen.getByPlaceholderText("YouTube URL"), {
      target: { value: "https://youtu.be/z1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "📝 직접 입력" }));

    fireEvent.click(screen.getByRole("button", { name: "🏛️ KOSHA" }));
    fireEvent.change(screen.getByPlaceholderText("KOSHA URL"), {
      target: { value: "https://kosha.example/doc" },
    });

    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "실패 콘텐츠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "교육자료 등록" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "create failed",
        }),
      );
    });
  });

  it("shows oembed error and submit validation-disabled state", async () => {
    oembedAsyncMock.mockRejectedValueOnce(new Error("oembed failed"));

    render(<ContentForm />);

    expect(
      screen.getByRole("button", { name: "교육자료 등록" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "▶️ YouTube" }));
    fireEvent.change(screen.getByPlaceholderText("YouTube URL"), {
      target: { value: "https://youtu.be/error" },
    });
    fireEvent.click(screen.getByRole("button", { name: "정보 가져오기" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "oembed failed",
        }),
      );
    });
  });

  it("covers content list interactions and error/success branches", async () => {
    const onEditContent = vi.fn();
    const onDeleteContent = vi.fn();

    render(
      <>
        <ContentList
          isLoading
          contents={[]}
          onEditContent={onEditContent}
          onDeleteContent={onDeleteContent}
        />
        <ContentList
          isLoading={false}
          contents={[
            {
              id: "c1",
              title: "텍스트 콘텐츠",
              contentType: "TEXT",
              externalSource: "KOSHA",
              description: "설명",
              createdAt: "2026-01-01",
              completionCount: 1,
              viewCount: 3,
            },
          ]}
          onEditContent={onEditContent}
          onDeleteContent={onDeleteContent}
        />
      </>,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "퀴즈 생성" }));
    await waitFor(() => {
      expect(generateQuizAsyncMock).toHaveBeenCalledWith("c1");
    });

    generateQuizAsyncMock.mockRejectedValueOnce(new Error("quiz failed"));
    fireEvent.click(screen.getByRole("button", { name: "퀴즈 생성" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "quiz failed",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));
    expect(
      screen.getByText(/AI가 교육 콘텐츠를 분석한 결과입니다/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("1명"));
    expect(screen.getByText(/텍스트 콘텐츠 - 이수자 목록/)).toBeInTheDocument();

    const iconOnlyButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconOnlyButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteAsyncMock).toHaveBeenCalledWith("c1");
      expect(onDeleteContent).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "dialog-close" })[0]);

    expect(screen.getAllByRole("button").length).toBeGreaterThan(4);
  });

  it("covers completion loading and empty branches in content list dialog", () => {
    mockUseEducationCompletions.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    function Harness() {
      const [selected, setSelected] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setSelected((prev) => !prev)}>
            toggle
          </button>
          <ContentList
            isLoading={false}
            contents={
              selected
                ? [
                    {
                      id: "c2",
                      title: "문서 콘텐츠",
                      contentType: "DOCUMENT",
                      externalSource: "LOCAL",
                      createdAt: "2026-02-01",
                      completionCount: 2,
                    },
                  ]
                : [
                    {
                      id: "c2",
                      title: "문서 콘텐츠",
                      contentType: "DOCUMENT",
                      externalSource: "LOCAL",
                      createdAt: "2026-02-01",
                      completionCount: 2,
                    },
                  ]
            }
            onEditContent={vi.fn()}
            onDeleteContent={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("2명"));
    expect(screen.getAllByText("로딩 중...").length).toBeGreaterThan(0);

    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, total: 0, limit: 20, totalPages: 0 },
      },
      isLoading: false,
    } as never);

    fireEvent.click(screen.getByRole("button", { name: "dialog-close" }));
    fireEvent.click(screen.getByText("2명"));
    expect(screen.getByText("이수자가 없습니다.")).toBeInTheDocument();
  });

  it("covers youtube source, completion rows, and delete dialog close/error", async () => {
    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [
          {
            id: "completion-1",
            userName: "",
            userCompany: "",
            signedAt: "2026-02-15T01:02:03.000Z",
          },
        ],
        pagination: { page: 1, total: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
    } as never);

    render(
      <ContentList
        isLoading={false}
        contents={[
          {
            id: "c-youtube",
            title: "유튜브 콘텐츠",
            contentType: "TEXT",
            externalSource: "YOUTUBE",
            createdAt: "2026-02-01",
            completionCount: 1,
          },
        ]}
        onEditContent={vi.fn()}
        onDeleteContent={vi.fn()}
      />,
    );

    expect(screen.getByText("YouTube")).toBeInTheDocument();

    fireEvent.click(screen.getByText("1명"));
    expect(screen.getByText("유튜브 콘텐츠 - 이수자 목록")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(1);
    expect(screen.getAllByText(/2026\./).length).toBeGreaterThan(1);

    const iconOnlyButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconOnlyButtons[1]);
    expect(screen.getByText("교육자료 삭제")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "alert-close" }));
    expect(screen.queryByText("교육자료 삭제")).not.toBeInTheDocument();

    deleteAsyncMock.mockRejectedValueOnce(new Error("delete failed"));
    fireEvent.click(iconOnlyButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "delete failed",
        }),
      );
    });
    expect(screen.queryByText("교육자료 삭제")).not.toBeInTheDocument();
  });
});
