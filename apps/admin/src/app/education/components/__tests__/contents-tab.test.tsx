import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentsTab } from "../contents-tab";
import {
  useCreateEducationContent,
  useDeleteEducationContent,
  useUpdateEducationContent,
  useEducationContents,
  useYouTubeOembed,
} from "@/hooks/use-api";
import { useEducationCompletions } from "@/hooks/use-education-completions";
import { useGenerateQuizFromContent } from "@/hooks/use-quiz-generation";

const toastMock = vi.fn();
const createAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();
const updateAsyncMock = vi.fn();
const oembedAsyncMock = vi.fn();

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="thumb" {...props} />
  ),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useCreateEducationContent: vi.fn(),
  useDeleteEducationContent: vi.fn(),
  useUpdateEducationContent: vi.fn(),
  useEducationContents: vi.fn(),
  useYouTubeOembed: vi.fn(),
}));

vi.mock("@/hooks/use-education-completions", () => ({
  useEducationCompletions: vi.fn(),
}));

vi.mock("@/hooks/use-quiz-generation", () => ({
  useGenerateQuizFromContent: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
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
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useToast: () => ({ toast: toastMock }),
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const mockUseEducationContents = vi.mocked(useEducationContents);
const mockUseCreateEducationContent = vi.mocked(useCreateEducationContent);
const mockUseDeleteEducationContent = vi.mocked(useDeleteEducationContent);
const mockUseUpdateEducationContent = vi.mocked(useUpdateEducationContent);
const mockUseYouTubeOembed = vi.mocked(useYouTubeOembed);
const mockUseEducationCompletions = vi.mocked(useEducationCompletions);
const mockUseGenerateQuizFromContent = vi.mocked(useGenerateQuizFromContent);

describe("contents tab", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createAsyncMock.mockReset();
    deleteAsyncMock.mockReset();
    updateAsyncMock.mockReset();
    oembedAsyncMock.mockReset();

    mockUseEducationContents.mockReturnValue({
      data: {
        contents: [
          {
            id: "c1",
            title: "안전교육 영상",
            contentType: "VIDEO",
            externalSource: "LOCAL",
            description: "desc",
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    } as never);

    mockUseCreateEducationContent.mockReturnValue({
      mutateAsync: createAsyncMock,
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
    mockUseUpdateEducationContent.mockReturnValue({
      mutateAsync: updateAsyncMock,
      isPending: false,
    } as never);
    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, total: 0, limit: 20, totalPages: 0 },
      },
      isLoading: false,
    } as never);
    mockUseGenerateQuizFromContent.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("renders list and creates content", async () => {
    render(<ContentsTab />);
    expect(screen.getAllByText("안전교육 영상")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /자료 등록/ }));

    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "신규 교육" },
    });
    fireEvent.click(screen.getByRole("button", { name: "교육자료 등록" }));

    await waitFor(() => {
      expect(createAsyncMock).toHaveBeenCalled();
    });
  });

  it("fetches youtube info and handles errors", async () => {
    oembedAsyncMock.mockResolvedValueOnce({
      title: "yt-title",
      thumbnailUrl: "https://example.com/thumb.jpg",
      videoId: "abc",
    });

    render(<ContentsTab />);
    fireEvent.click(screen.getByRole("button", { name: /자료 등록/ }));
    fireEvent.click(screen.getByRole("button", { name: "▶️ YouTube" }));

    fireEvent.change(screen.getByPlaceholderText("YouTube URL"), {
      target: { value: "https://youtu.be/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "정보 가져오기" }));

    await waitFor(() => {
      expect(oembedAsyncMock).toHaveBeenCalledWith("https://youtu.be/abc");
    });

    oembedAsyncMock.mockRejectedValueOnce(new Error("fail"));
    fireEvent.click(screen.getByRole("button", { name: "정보 가져오기" }));
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("opens and closes form with toggle button", () => {
    render(<ContentsTab />);

    fireEvent.click(screen.getByRole("button", { name: /자료 등록/ }));
    expect(screen.getByText("교육 콘텐츠 등록")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(screen.queryByText("교육 콘텐츠 등록")).not.toBeInTheDocument();
  });

  it("edits existing content", async () => {
    render(<ContentsTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(iconButtons[0]);
    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "수정 콘텐츠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "교육 콘텐츠 수정" }));

    await waitFor(() => {
      expect(updateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "c1" }),
      );
    });
  });
});
