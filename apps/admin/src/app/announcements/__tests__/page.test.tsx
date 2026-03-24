import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnnouncementsPage from "../page";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/use-api";
import { useGenerateAnnouncementDraft } from "@/hooks/use-announcement-ai-draft";
import { useAuthStore } from "@/stores/auth";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
const createMutateMock = vi.fn();
const updateMutateMock = vi.fn();
const deleteMutateMock = vi.fn();
const generateDraftMutateAsyncMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/announcements",
}));

vi.mock("@/hooks/use-api", () => ({
  useAdminAnnouncements: vi.fn(),
  useCreateAnnouncement: vi.fn(),
  useUpdateAnnouncement: vi.fn(),
  useDeleteAnnouncement: vi.fn(),
}));

vi.mock("@/hooks/use-announcement-ai-draft", () => ({
  useGenerateAnnouncementDraft: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <textarea
      aria-label={placeholder}
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    size,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    size?: string;
  }) => (
    <button
      type={type ?? "button"}
      disabled={disabled}
      data-size={size}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
    />
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div>
      {open && children}
      <button type="button" onClick={() => onOpenChange?.(false)}>
        alert-dialog-close
      </button>
    </div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h3>{children}</h3>
  ),
  toast: toastMock,
}));

const mockUseAdminAnnouncements = vi.mocked(useAdminAnnouncements);
const mockUseCreateAnnouncement = vi.mocked(useCreateAnnouncement);
const mockUseUpdateAnnouncement = vi.mocked(useUpdateAnnouncement);
const mockUseDeleteAnnouncement = vi.mocked(useDeleteAnnouncement);
const mockUseGenerateAnnouncementDraft = vi.mocked(
  useGenerateAnnouncementDraft,
);
const mockUseAuthStore = vi.mocked(useAuthStore);

const toAnnouncementsResult = (
  value: unknown,
): ReturnType<typeof useAdminAnnouncements> => value as never;

describe("AnnouncementsPage", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createMutateMock.mockReset();
    updateMutateMock.mockReset();
    deleteMutateMock.mockReset();
    generateDraftMutateAsyncMock.mockReset();
    mockUseAuthStore.mockImplementation((selector) =>
      selector({ currentSiteId: "site-1" } as Parameters<typeof selector>[0]),
    );
    mockUseGenerateAnnouncementDraft.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: generateDraftMutateAsyncMock,
      isPending: false,
    } as never);

    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({ data: [], isLoading: false }),
    );
    mockUseCreateAnnouncement.mockReturnValue({
      mutate: createMutateMock,
      isPending: false,
    } as never);
    mockUseUpdateAnnouncement.mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as never);
    mockUseDeleteAnnouncement.mockReturnValue({
      mutate: deleteMutateMock,
      isPending: false,
    } as never);
  });

  it("renders loading and empty states", () => {
    mockUseAdminAnnouncements.mockReturnValueOnce(
      toAnnouncementsResult({ data: [], isLoading: true }),
    );
    const { rerender } = render(<AnnouncementsPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({ data: [], isLoading: false }),
    );
    rerender(<AnnouncementsPage />);
    expect(screen.getByText("공지사항이 없습니다")).toBeInTheDocument();
  });

  it("creates announcement and resets form on success", async () => {
    createMutateMock.mockImplementation(
      (_payload, options: { onSuccess?: () => void }) => {
        options.onSuccess?.();
      },
    );

    const { unmount } = render(<AnnouncementsPage />);

    fireEvent.click(screen.getByRole("button", { name: /새 공지/ }));
    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "안전 공지" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "헬멧 착용 필수" },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "안전 공지",
          content: "헬멧 착용 필수",
          isPinned: false,
        }),
        expect.any(Object),
      );
    });
  });

  it("handles pin and scheduled publish inputs including cancel", async () => {
    createMutateMock.mockImplementation(
      (_payload, options: { onSuccess?: () => void }) => {
        options.onSuccess?.();
      },
    );

    render(<AnnouncementsPage />);

    fireEvent.click(screen.getByRole("button", { name: /새 공지/ }));
    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "예약 공지" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "예약 내용" },
    });
    fireEvent.click(screen.getByLabelText("상단 고정"));

    const scheduledInput = screen.getByLabelText("예약 발행");
    fireEvent.change(scheduledInput, {
      target: { value: "2026-03-15T10:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "예약 취소" }));
    expect(screen.getByLabelText("예약 발행")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("예약 발행"), {
      target: { value: "2026-03-16T11:45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "예약 공지",
          content: "예약 내용",
          isPinned: true,
          scheduledAt: "2026-03-16T11:45",
        }),
        expect.any(Object),
      );
    });
  });

  it("edits announcement and submits update", async () => {
    updateMutateMock.mockImplementation(
      (_payload, options: { onSuccess?: () => void }) => {
        options.onSuccess?.();
      },
    );
    mockUseAdminAnnouncements.mockReturnValueOnce(
      toAnnouncementsResult({
        isLoading: false,
        data: [
          {
            id: "ann-1",
            title: "기존 공지",
            content: "<p>본문</p>",
            isPinned: true,
            scheduledAt: null,
            status: "PUBLISHED",
            createdAt: "2026-02-28T00:00:00.000Z",
          },
        ],
      }),
    );

    const { unmount } = render(<AnnouncementsPage />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim() === "");
    fireEvent.click(iconButtons[0]);
    fireEvent.change(screen.getByPlaceholderText("제목"), {
      target: { value: "수정 공지" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "수정 내용" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    await waitFor(() => {
      expect(updateMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ann-1",
          title: "수정 공지",
          content: "수정 내용",
        }),
        expect.any(Object),
      );
    });
  });

  it("confirms delete and handles success/error toasts", async () => {
    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({
        isLoading: false,
        data: [
          {
            id: "ann-1",
            title: "공지",
            content: "<p>본문</p>",
            isPinned: false,
            scheduledAt: null,
            status: "PUBLISHED",
            createdAt: "2026-02-28T00:00:00.000Z",
          },
        ],
      }),
    );
    deleteMutateMock.mockImplementationOnce(
      (_id, options: { onSuccess?: () => void }) => {
        options.onSuccess?.();
      },
    );
    deleteMutateMock.mockImplementationOnce(
      (_id, options: { onError?: (e: Error) => void }) => {
        options.onError?.(new Error("삭제 실패"));
      },
    );

    render(<AnnouncementsPage />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim() === "");
    fireEvent.click(iconButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith(
        "ann-1",
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "삭제되었습니다." }),
      );
    });

    fireEvent.click(iconButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: expect.stringContaining("삭제 실패"),
        }),
      );
    });
  });

  it("closes delete dialog when open state changes to false", () => {
    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({
        isLoading: false,
        data: [
          {
            id: "ann-close",
            title: "닫기 공지",
            content: "<p>본문</p>",
            isPinned: false,
            scheduledAt: null,
            status: "PUBLISHED",
            createdAt: "2026-02-28T00:00:00.000Z",
          },
        ],
      }),
    );

    render(<AnnouncementsPage />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.trim() === "");
    fireEvent.click(iconButtons[1]);
    expect(screen.getByText("삭제 확인")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "alert-dialog-close" }));
    expect(screen.queryByText("삭제 확인")).not.toBeInTheDocument();
  });

  it("generates AI draft, applies title/content, and clears keyword input", async () => {
    generateDraftMutateAsyncMock.mockResolvedValue({
      title: "AI 공지 제목",
      content: "AI 공지 본문",
    });

    render(<AnnouncementsPage />);

    fireEvent.click(screen.getByRole("button", { name: /새 공지/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 초안 생성" }));

    fireEvent.change(
      screen.getByPlaceholderText(
        "키워드 입력 (예: 하절기 안전, 폭염 대비, 작업 중지)",
      ),
      {
        target: { value: "폭염 대비" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "생성" }));

    await waitFor(() => {
      expect(generateDraftMutateAsyncMock).toHaveBeenCalledWith({
        keywords: "폭염 대비",
        siteId: "site-1",
      });
      expect(screen.getByDisplayValue("AI 공지 제목")).toBeInTheDocument();
      expect(screen.getByDisplayValue("AI 공지 본문")).toBeInTheDocument();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "AI 초안이 생성되었습니다." }),
      );
    });
  });

  it("handles AI draft failure and no-site guard", async () => {
    generateDraftMutateAsyncMock.mockRejectedValue(new Error("생성 실패"));

    const { unmount } = render(<AnnouncementsPage />);
    fireEvent.click(screen.getByRole("button", { name: /새 공지/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 초안 생성" }));
    fireEvent.change(
      screen.getByPlaceholderText(
        "키워드 입력 (예: 하절기 안전, 폭염 대비, 작업 중지)",
      ),
      {
        target: { value: "야간 작업" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "생성" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "생성 실패",
        }),
      );
    });

    unmount();
    mockUseAuthStore.mockImplementation((selector) =>
      selector({ currentSiteId: null } as Parameters<typeof selector>[0]),
    );
    render(<AnnouncementsPage />);
    fireEvent.click(screen.getByRole("button", { name: /새 공지/ }));
    fireEvent.click(screen.getByRole("button", { name: "AI 초안 생성" }));
    fireEvent.change(
      screen.getByPlaceholderText(
        "키워드 입력 (예: 하절기 안전, 폭염 대비, 작업 중지)",
      ),
      {
        target: { value: "장비 점검" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "생성" }));
    expect(generateDraftMutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("renders rich html blocks and scheduled metadata", () => {
    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({
        isLoading: false,
        data: [
          {
            id: "ann-rich",
            title: "복합 공지",
            content:
              "<h3>헤더</h3><p>문단 <strong>강조</strong><br/></p><ul><li>항목1</li></ul><section>기타</section>",
            isPinned: true,
            scheduledAt: "2026-03-02T10:00:00.000Z",
            status: "SCHEDULED",
            createdAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      }),
    );

    render(<AnnouncementsPage />);

    expect(screen.getByText("헤더")).toBeInTheDocument();
    expect(screen.getByText("문단")).toBeInTheDocument();
    expect(screen.getByText("강조")).toBeInTheDocument();
    expect(screen.getByText("항목1")).toBeInTheDocument();
    expect(screen.getByText("기타")).toBeInTheDocument();
    expect(screen.getByText("고정")).toBeInTheDocument();
    expect(screen.getByText("예약")).toBeInTheDocument();
    expect(screen.getByText(/· 예약:/)).toBeInTheDocument();
  });

  it("renders plain text content when DOMParser is unavailable", () => {
    const original = globalThis.DOMParser;
    Object.defineProperty(globalThis, "DOMParser", {
      configurable: true,
      value: undefined,
    });

    mockUseAdminAnnouncements.mockReturnValue(
      toAnnouncementsResult({
        isLoading: false,
        data: [
          {
            id: "ann-text",
            title: "텍스트 공지",
            content: "단순 문자열",
            isPinned: false,
            scheduledAt: null,
            status: "PUBLISHED",
            createdAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      }),
    );

    render(<AnnouncementsPage />);
    expect(screen.getByText("단순 문자열")).toBeInTheDocument();

    Object.defineProperty(globalThis, "DOMParser", {
      configurable: true,
      value: original,
    });
  });
});
