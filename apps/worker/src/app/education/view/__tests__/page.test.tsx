import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EducationViewPage from "@/app/education/view/page";
import {
  useEducationCompletionStatus,
  useEducationContent,
  useSubmitEducationCompletion,
} from "@/hooks/use-api";
import { setMockSearchParams, getMockRouter } from "@/__tests__/mocks";

const toastMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useEducationContent: vi.fn(),
  useEducationCompletionStatus: vi.fn(),
  useSubmitEducationCompletion: vi.fn(),
}));
vi.mock("@/hooks/use-education-api", () => ({}));
vi.mock("@/stores/auth", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/i18n/context", () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
    AlertDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div>{children}</div> : null),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogAction: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("app/education/view/page", () => {
  beforeEach(() => {
    toastMock.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (contextId: string) => {
        if (contextId !== "2d") {
          return null;
        }
        return {
          clearRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          lineCap: "round",
          lineWidth: 2,
          strokeStyle: "#111827",
        } as unknown as CanvasRenderingContext2D;
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,signature",
    );
  });

  it("renders loading state", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);
    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("bottom-nav")).toBeInTheDocument();
  });

  it("renders not found state", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("x"),
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));

    expect(getMockRouter().back).toHaveBeenCalled();
  });

  it("renders not found state when content data is missing without error", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(screen.getByText("education.notFound")).toBeInTheDocument();
  });

  it("renders content detail and back button", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "교육 자료",
        contentType: "TEXT",
        category: "SAFETY",
        isRequired: true,
        createdAt: "2026-02-28T00:00:00Z",
        content: "교육 상세",
        description: "요약",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(screen.getByText("교육 자료")).toBeInTheDocument();
    expect(screen.getByText("education.requiredEducation")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "education.backToList" }),
    );
    expect(getMockRouter().back).toHaveBeenCalled();
  });

  it("renders video content with youtube embed/watch urls", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "영상 교육",
        contentType: "VIDEO",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "동영상 상세",
        description: "요약",
        sourceUrl: "https://youtu.be/abc123xyz",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    const iframe = screen.getByTitle("영상 교육");
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/abc123xyz"),
    );
    expect(
      screen.getByRole("link", { name: "YouTube에서 보기" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123xyz");
  });

  it("downloads document and validates empty signature submission", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "문서 교육",
        contentType: "DOCUMENT",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "문서 상세",
        contentUrl: "https://example.com/manual.pdf",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "education.documentDownload" }),
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/manual.pdf",
      "_blank",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.open" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.submit" }),
    );

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "education.signature.needStroke",
        variant: "destructive",
      }),
    );

    openSpy.mockRestore();
  });

  it("submits signature and handles success/error callbacks", async () => {
    setMockSearchParams({ id: "e1" });
    const mutate = vi.fn(
      (
        _payload: unknown,
        options: { onSuccess: () => void; onError: () => void },
      ) => {
        options.onSuccess();
        options.onError();
      },
    );
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "문서 교육",
        contentType: "DOCUMENT",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "문서 상세",
        contentUrl: "https://example.com/manual.pdf",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    const { container } = render(<EducationViewPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.open" }),
    );

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 600,
      height: 240,
      top: 0,
      right: 600,
      bottom: 240,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 30 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.submit" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        {
          contentId: "e1",
          signature: "data:image/png;base64,signature",
        },
        expect.any(Object),
      );
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "education.signature.toastSaved" }),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "education.signature.toastError",
        variant: "destructive",
      }),
    );
  });

  it("renders video iframe with non-youtube source and closes signature modal", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "외부 영상",
        contentType: "VIDEO",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "외부 상세",
        sourceUrl: "not-a-url",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: {
        completion: {
          signedAt: "2026-02-28T12:00:00Z",
          signatureData: "data:image/png;base64,done",
        },
      },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    const { container } = render(<EducationViewPage />);
    const iframe = screen.getByTitle("외부 영상");
    expect(iframe).toHaveAttribute("src", "not-a-url");
    expect(screen.getByRole("img", { name: "education.signature.previewAlt" }));

    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.resign" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(container.querySelector("canvas")).not.toBeInTheDocument();
  });

  it("converts youtube watch urls to embed urls", () => {
    setMockSearchParams({ id: "e-youtube" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e-youtube",
        title: "유튜브 교육",
        contentType: "VIDEO",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "유튜브 상세",
        sourceUrl: "https://www.youtube.com/watch?v=watch12345",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(screen.getByTitle("유튜브 교육")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/watch12345"),
    );
    expect(
      screen.getByRole("link", { name: "YouTube에서 보기" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=watch12345");
  });

  it("converts youtube shorts urls to embed urls", () => {
    setMockSearchParams({ id: "e-youtube-shorts" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e-youtube-shorts",
        title: "쇼츠 교육",
        contentType: "VIDEO",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "쇼츠 상세",
        sourceUrl: "https://www.youtube.com/shorts/shorts12345",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(screen.getByTitle("쇼츠 교육")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/shorts12345"),
    );
  });

  it("renders image content branch", () => {
    setMockSearchParams({ id: "e1" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "이미지 교육",
        contentType: "IMAGE",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "이미지 상세",
        contentUrl: "https://example.com/image.png",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(screen.getByRole("img", { name: "이미지 교육" })).toHaveAttribute(
      "src",
      "https://example.com/image.png",
    );
  });

  it("does not submit signature when id is missing", async () => {
    const mutate = vi.fn();
    setMockSearchParams({});
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e1",
        title: "문서 교육",
        contentType: "DOCUMENT",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "문서 상세",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    const { container } = render(<EducationViewPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.open" }),
    );

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 600,
      height: 240,
      top: 0,
      right: 600,
      bottom: 240,
      left: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 15 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.submit" }),
    );

    await waitFor(() => {
      expect(mutate).not.toHaveBeenCalled();
    });
  });

  it("disables signature open while completion status is loading", () => {
    setMockSearchParams({ id: "e-loading" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e-loading",
        title: "로딩 상태",
        contentType: "TEXT",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "내용",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: true,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);

    render(<EducationViewPage />);

    expect(
      screen.getByRole("button", { name: "education.signature.open" }),
    ).toBeDisabled();
  });

  it("shows submitting state while signature mutation is pending", () => {
    setMockSearchParams({ id: "e-submit" });
    vi.mocked(useEducationContent).mockReturnValue({
      data: {
        id: "e-submit",
        title: "제출 중",
        contentType: "TEXT",
        category: "SAFETY",
        isRequired: false,
        createdAt: "2026-02-28T00:00:00Z",
        content: "내용",
      },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useEducationCompletionStatus).mockReturnValue({
      data: { completion: null },
      isLoading: false,
    } as never);
    vi.mocked(useSubmitEducationCompletion).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as never);

    render(<EducationViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "education.signature.open" }),
    );
    expect(
      screen.getByRole("button", { name: "education.signature.submitting" }),
    ).toBeDisabled();
  });
});
