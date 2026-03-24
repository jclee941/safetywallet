import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EducationPage from "@/app/education/page";
import {
  useAttendTbm,
  useEducationContents,
  useQuizzes,
  useTbmRecords,
} from "@/hooks/use-api";

const toastMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    currentSiteId: "site-1",
    isAuthenticated: true,
    _hasHydrated: true,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    setCurrentSite: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-api", () => ({
  useEducationContents: vi.fn(),
  useQuizzes: vi.fn(),
  useTbmRecords: vi.fn(),
  useAttendTbm: vi.fn(),
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
  };
});

describe("app/education/page", () => {
  beforeEach(() => {
    toastMock.mockReset();
    vi.mocked(useEducationContents).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useQuizzes).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useTbmRecords).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useAttendTbm).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it("renders empty contents tab", () => {
    render(<EducationPage />);
    expect(screen.getByText("education.noMaterials")).toBeInTheDocument();
  });

  it("switches back to materials tab via materials button", () => {
    render(<EducationPage />);

    fireEvent.click(screen.getByRole("button", { name: "education.quizzes" }));
    fireEvent.click(
      screen.getByRole("button", { name: "education.materials" }),
    );

    expect(screen.getByText("education.noMaterials")).toBeInTheDocument();
  });

  it("switches to quizzes and tbm tabs", () => {
    render(<EducationPage />);
    fireEvent.click(screen.getByRole("button", { name: "education.quizzes" }));
    expect(screen.getByText("education.noQuizzes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));
    expect(screen.getByText("education.noRecords")).toBeInTheDocument();
  });

  it("handles TBM attend action", async () => {
    const mutate = vi.fn((_id: unknown, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    vi.mocked(useAttendTbm).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useTbmRecords).mockReturnValue({
      data: [
        {
          id: "tbm1",
          title: "안전 미팅",
          date: "2026-02-28",
          location: "A동",
          content: null,
          safetyTopic: "안전",
          leader: { nameMasked: "관리자" },
          _count: { attendees: 3 },
        },
      ],
      isLoading: false,
    } as never);

    render(<EducationPage />);
    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));
    fireEvent.click(
      screen.getByRole("button", { name: "education.attendanceConfirm" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith("tbm1", expect.any(Object));
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "education.attendanceConfirmed" }),
    );
  });

  it("renders contents and quizzes list cards", () => {
    vi.mocked(useEducationContents).mockReturnValue({
      data: [
        {
          id: "c1",
          title: "필수 영상",
          contentType: "VIDEO",
          isRequired: true,
          createdAt: "2026-03-01T00:00:00Z",
          viewCount: 12,
          completionCount: 3,
        },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useQuizzes).mockReturnValue({
      data: [
        {
          id: "q1",
          title: "활성 퀴즈",
          description: "설명",
          isActive: true,
          timeLimitMinutes: null,
          maxAttempts: 2,
          questionCount: 5,
          attemptCount: 4,
        },
        {
          id: "q2",
          title: "마감 퀴즈",
          description: null,
          isActive: false,
          timeLimitMinutes: 15,
          maxAttempts: 0,
          questionCount: 2,
          attemptCount: 0,
        },
      ],
      isLoading: false,
    } as never);

    render(<EducationPage />);
    expect(screen.getByText("필수 영상")).toBeInTheDocument();
    expect(screen.getByText("education.required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "education.quizzes" }));
    expect(screen.getByText("활성 퀴즈")).toBeInTheDocument();
    expect(screen.getByText("education.active")).toBeInTheDocument();
    expect(screen.getByText("education.unlimited")).toBeInTheDocument();
    expect(screen.getByText("마감 퀴즈")).toBeInTheDocument();
    expect(screen.getByText("15education.minutes")).toBeInTheDocument();
  });

  it("handles TBM attend API errors with specific and fallback toasts", async () => {
    const mutate = vi.fn(
      (
        _id: string,
        options: { onError: (error: { message: string }) => void },
      ) => {
        options.onError({
          message: JSON.stringify({ error: { code: "ALREADY_ATTENDED" } }),
        });
        options.onError({ message: "not-json" });
      },
    );
    vi.mocked(useAttendTbm).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useTbmRecords).mockReturnValue({
      data: [
        {
          id: "tbm2",
          title: "오전 TBM",
          date: "2026-03-03",
          location: "",
          content: "내용",
          safetyTopic: "안전",
          leader: { nameMasked: "팀장" },
          _count: { attendees: 1 },
        },
      ],
      isLoading: false,
    } as never);

    render(<EducationPage />);
    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));
    fireEvent.click(
      screen.getByRole("button", { name: "education.attendanceConfirm" }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "education.alreadyAttended",
          variant: "destructive",
        }),
      );
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "education.attendanceConfirmFailed",
        variant: "destructive",
      }),
    );
  });

  it("renders TBM loading state", () => {
    vi.mocked(useTbmRecords).mockReturnValue({
      data: [],
      isLoading: true,
    } as never);

    const { container } = render(<EducationPage />);
    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));
    expect(screen.queryByText("education.noRecords")).not.toBeInTheDocument();
    expect(container.textContent).toContain("header");
  });

  it("renders loading states for contents and quizzes tabs", () => {
    vi.mocked(useEducationContents).mockReturnValue({
      data: [],
      isLoading: true,
    } as never);
    vi.mocked(useQuizzes).mockReturnValue({
      data: [],
      isLoading: true,
    } as never);

    const { container } = render(<EducationPage />);
    expect(screen.queryByText("education.noMaterials")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "education.quizzes" }));
    expect(screen.queryByText("education.noQuizzes")).not.toBeInTheDocument();
    expect(container.textContent).toContain("header");
  });

  it("renders TBM fallback title and on-site location", () => {
    vi.mocked(useTbmRecords).mockReturnValue({
      data: [
        {
          id: "tbm3",
          title: null,
          date: "2026-03-03",
          location: "",
          content: null,
          safetyTopic: null,
          leader: null,
          _count: null,
        },
      ],
      isLoading: false,
    } as never);

    render(<EducationPage />);
    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));

    expect(screen.getAllByText("education.tbm").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByText("education.onSite")).toBeInTheDocument();
    expect(
      screen.getByText(/education.attendance 0education.attendees/),
    ).toBeInTheDocument();
  });

  it("switches from TBM back to materials tab", () => {
    render(<EducationPage />);

    fireEvent.click(screen.getByRole("button", { name: "education.tbm" }));
    fireEvent.click(
      screen.getByRole("button", { name: "education.materials" }),
    );

    expect(screen.getByText("education.noMaterials")).toBeInTheDocument();
  });
});
