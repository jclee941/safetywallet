import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TbmTopicCategory } from "@safetywallet/types";
import { TbmAiAnalysis } from "../tbm-tab/tbm-ai-analysis";
import { TbmMeetingMinutes } from "../tbm-tab/tbm-meeting-minutes";
import { TbmForm } from "../tbm-tab/tbm-form";
import { TbmList } from "../tbm-tab/tbm-list";
import type { TbmFormState } from "../education-types";
import { useTbmRecord } from "@/hooks/use-api";
import {
  useTbmAiAnalysis,
  useTriggerTbmAiAnalysis,
} from "@/hooks/use-tbm-ai-analysis";
import {
  useTbmMeetingMinutes,
  useTriggerTbmMeetingMinutes,
} from "@/hooks/use-tbm-meeting-minutes";

const toastMock = vi.fn();
const triggerAiMock = vi.fn();
const triggerMinutesMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useTbmRecord: vi.fn(),
}));

vi.mock("@/hooks/use-tbm-ai-analysis", () => ({
  useTbmAiAnalysis: vi.fn(),
  useTriggerTbmAiAnalysis: vi.fn(),
}));

vi.mock("@/hooks/use-tbm-meeting-minutes", () => ({
  useTbmMeetingMinutes: vi.fn(),
  useTriggerTbmMeetingMinutes: vi.fn(),
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
  useToast: () => ({ toast: toastMock }),
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
}));

const mockUseTbmRecord = vi.mocked(useTbmRecord);
const mockUseTbmAiAnalysis = vi.mocked(useTbmAiAnalysis);
const mockUseTriggerTbmAiAnalysis = vi.mocked(useTriggerTbmAiAnalysis);
const mockUseTbmMeetingMinutes = vi.mocked(useTbmMeetingMinutes);
const mockUseTriggerTbmMeetingMinutes = vi.mocked(useTriggerTbmMeetingMinutes);

describe("tbm ai components", () => {
  beforeEach(() => {
    triggerAiMock.mockReset();
    triggerMinutesMock.mockReset();

    mockUseTriggerTbmAiAnalysis.mockReturnValue({
      mutate: triggerAiMock,
      isPending: false,
    } as never);
    mockUseTriggerTbmMeetingMinutes.mockReturnValue({
      mutate: triggerMinutesMock,
      isPending: false,
    } as never);
  });

  it("renders tbm ai loading/empty/result branches", () => {
    mockUseTbmAiAnalysis.mockReturnValueOnce({
      isLoading: true,
      data: undefined,
    } as never);
    const { rerender } = render(<TbmAiAnalysis tbmId="t1" />);
    expect(screen.getByText("분석 결과 로딩 중...")).toBeInTheDocument();

    mockUseTbmAiAnalysis.mockReturnValueOnce({
      isLoading: false,
      data: { analysis: null, analyzedAt: null },
    } as never);
    rerender(<TbmAiAnalysis tbmId="t1" />);
    fireEvent.click(screen.getByRole("button", { name: "AI 분석 시작" }));
    expect(triggerAiMock).toHaveBeenCalledWith("t1");

    mockUseTbmAiAnalysis.mockReturnValueOnce({
      isLoading: false,
      data: {
        analyzedAt: "2026-02-01T01:00:00.000Z",
        analysis: {
          riskLevel: "unknown",
          confidence: 0.85,
          summary: "요약",
          identifiedRisks: ["추락"],
          safetyChecklist: ["점검"],
          precautions: ["주의"],
          relatedRegulations: ["규정"],
          modelVersion: "tbm-v1",
        },
      },
    } as never);
    rerender(<TbmAiAnalysis tbmId="t1" />);
    expect(screen.getAllByText("요약").length).toBeGreaterThan(0);
    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.getByText("tbm-v1")).toBeInTheDocument();
  });

  it("renders meeting minutes loading/empty/result branches", () => {
    mockUseTbmMeetingMinutes.mockReturnValueOnce({
      isLoading: true,
      data: undefined,
    } as never);

    const { rerender } = render(<TbmMeetingMinutes tbmId="t1" />);
    expect(screen.getByText("회의록 로딩 중...")).toBeInTheDocument();

    mockUseTbmMeetingMinutes.mockReturnValueOnce({
      isLoading: false,
      data: { minutes: null, generatedAt: null },
    } as never);
    rerender(<TbmMeetingMinutes tbmId="t1" />);
    fireEvent.click(screen.getByRole("button", { name: "회의록 생성" }));
    expect(triggerMinutesMock).toHaveBeenCalledWith("t1");

    mockUseTbmMeetingMinutes.mockReturnValueOnce({
      isLoading: false,
      data: {
        generatedAt: "2026-02-01T02:00:00.000Z",
        minutes: {
          title: "아침 TBM",
          date: "2026-02-01",
          location: "현장",
          leader: "팀장",
          attendeeCount: 3,
          weatherCondition: "맑음",
          agenda: ["점검"],
          discussionPoints: ["주의"],
          safetyInstructions: ["장비 착용"],
          riskAssessment: { level: "unknown", keyRisks: ["추락"] },
          actionItems: ["난간 확인"],
          conclusion: "종료",
          modelVersion: "minutes-v1",
        },
      },
    } as never);
    rerender(<TbmMeetingMinutes tbmId="t1" />);

    expect(screen.getByText("아침 TBM")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.getByText(/minutes-v1/)).toBeInTheDocument();
  });
});

describe("tbm form and list", () => {
  beforeEach(() => {
    toastMock.mockReset();
    mockUseTbmRecord.mockReturnValue({
      data: {
        attendeeCount: 1,
        attendees: [
          {
            userName: "홍길동",
            attendee: { id: "a1", attendedAt: "2026-02-01T00:00:00.000Z" },
          },
        ],
      },
    } as never);
    mockUseTbmAiAnalysis.mockReturnValue({
      isLoading: false,
      data: { analysis: null },
    } as never);
    mockUseTbmMeetingMinutes.mockReturnValue({
      isLoading: false,
      data: { minutes: null },
    } as never);
  });

  it("submits tbm form success and failure", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(undefined);
    const onSubmitFail = vi.fn().mockRejectedValueOnce(new Error("fail"));

    const baseProps = {
      tbmForm: {
        date: "2026-02-01",
        topic: "안전점검",
        topicCategory: undefined,
        content: "내용",
        weatherCondition: "맑음",
        specialNotes: "없음",
      },
      setTbmForm: vi.fn(),
      editingTbmId: null,
      currentSiteId: "site-1",
      createMutation: { mutateAsync: vi.fn(), isPending: false },
      updateMutation: { mutateAsync: vi.fn(), isPending: false },
      onCancelEdit: vi.fn(),
    };

    const { rerender } = render(<TbmForm {...baseProps} onSubmit={onSubmit} />);
    fireEvent.change(document.querySelector("input[type='date']")!, {
      target: { value: "2026-02-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "TBM 등록" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "TBM 기록이 등록되었습니다." }),
      );
    });

    rerender(
      <TbmForm {...baseProps} editingTbmId="t1" onSubmit={onSubmitFail} />,
    );

    fireEvent.change(screen.getByPlaceholderText("주제"), {
      target: { value: "수정 주제" },
    });
    fireEvent.change(screen.getByPlaceholderText("내용"), {
      target: { value: "수정 내용" },
    });
    fireEvent.change(screen.getByPlaceholderText("날씨"), {
      target: { value: "흐림" },
    });
    fireEvent.change(screen.getByPlaceholderText("특이사항"), {
      target: { value: "주의" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: TbmTopicCategory.FALL_PREVENTION },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "TBM 수정" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });

    expect(baseProps.setTbmForm).toHaveBeenCalled();
  });

  it("updates date and topic category through live state", () => {
    function Harness() {
      const [tbmForm, setTbmForm] = useState<TbmFormState>({
        date: "",
        topic: "주제",
        content: "",
        weatherCondition: "",
        specialNotes: "",
      });

      return (
        <TbmForm
          tbmForm={tbmForm}
          setTbmForm={setTbmForm}
          editingTbmId={null}
          currentSiteId="site-1"
          createMutation={{ mutateAsync: vi.fn(), isPending: false }}
          updateMutation={{ mutateAsync: vi.fn(), isPending: false }}
          onSubmit={vi.fn()}
          onCancelEdit={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.change(document.querySelector("input[type='date']")!, {
      target: { value: "2026-04-01" },
    });
    fireEvent.change(screen.getByPlaceholderText("주제"), {
      target: { value: "주제 변경" },
    });
    fireEvent.change(screen.getByPlaceholderText("내용"), {
      target: { value: "내용 변경" },
    });
    fireEvent.change(screen.getByPlaceholderText("날씨"), {
      target: { value: "맑음" },
    });
    fireEvent.change(screen.getByPlaceholderText("특이사항"), {
      target: { value: "특이 없음" },
    });
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("주제 변경")).toBeInTheDocument();
    expect(screen.getByDisplayValue("내용 변경")).toBeInTheDocument();
    expect(screen.getByDisplayValue("맑음")).toBeInTheDocument();
    expect(screen.getByDisplayValue("특이 없음")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: TbmTopicCategory.GENERAL },
    });
    expect(screen.getByRole("combobox")).toHaveValue(TbmTopicCategory.GENERAL);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "" },
    });
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows edit success toast when submit resolves in edit mode", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(undefined);

    render(
      <TbmForm
        tbmForm={{
          date: "2026-05-01",
          topic: "편집",
          topicCategory: TbmTopicCategory.GENERAL,
          content: "",
          weatherCondition: "",
          specialNotes: "",
        }}
        setTbmForm={vi.fn()}
        editingTbmId="tbm-1"
        currentSiteId="site-1"
        createMutation={{ mutateAsync: vi.fn(), isPending: false }}
        updateMutation={{ mutateAsync: vi.fn(), isPending: false }}
        onSubmit={onSubmit}
        onCancelEdit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "TBM 수정" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "TBM 기록이 수정되었습니다." }),
      );
    });
  });

  it("handles disabled submit states and edit cancel", () => {
    const onCancelEdit = vi.fn();

    const { rerender } = render(
      <TbmForm
        tbmForm={{
          date: "",
          topic: "",
          topicCategory: undefined,
          content: "",
          weatherCondition: "",
          specialNotes: "",
        }}
        setTbmForm={vi.fn()}
        editingTbmId={null}
        currentSiteId={null}
        createMutation={{ mutateAsync: vi.fn(), isPending: false }}
        updateMutation={{ mutateAsync: vi.fn(), isPending: false }}
        onSubmit={vi.fn()}
        onCancelEdit={onCancelEdit}
      />,
    );

    expect(screen.getByRole("button", { name: "TBM 등록" })).toBeDisabled();

    rerender(
      <TbmForm
        tbmForm={{
          date: "2026-03-02",
          topic: "회의",
          topicCategory: TbmTopicCategory.GENERAL,
          content: "내용",
          weatherCondition: "맑음",
          specialNotes: "",
        }}
        setTbmForm={vi.fn()}
        editingTbmId="tbm-1"
        currentSiteId="site-1"
        createMutation={{ mutateAsync: vi.fn(), isPending: false }}
        updateMutation={{ mutateAsync: vi.fn(), isPending: true }}
        onSubmit={vi.fn()}
        onCancelEdit={onCancelEdit}
      />,
    );

    expect(screen.getByRole("button", { name: "TBM 수정" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it("renders tbm list branches and interactions", async () => {
    const onEditTbm = vi.fn();
    const onDeleteTbm = vi.fn().mockResolvedValue(undefined);

    render(
      <>
        <TbmList
          tbmRecords={[]}
          isLoading
          onEditTbm={onEditTbm}
          onDeleteTbm={onDeleteTbm}
          deleteMutation={{ isPending: false }}
        />
        <TbmList
          tbmRecords={[
            {
              leaderName: "팀장",
              attendeeCount: 1,
              tbm: {
                id: "t1",
                date: "2026-02-01",
                topic: "아침점검",
                topicCategory: TbmTopicCategory.GENERAL,
                weatherCondition: "맑음",
              },
            },
          ]}
          isLoading={false}
          onEditTbm={onEditTbm}
          onDeleteTbm={onDeleteTbm}
          deleteMutation={{ isPending: false }}
        />
      </>,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));
    fireEvent.click(screen.getByRole("button", { name: "회의록" }));
    fireEvent.click(screen.getByRole("button", { name: "참석자 보기" }));
    const unnamedButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");
    fireEvent.click(unnamedButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getAllByRole("button", { name: "dialog-close" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "alert-close" }));

    await waitFor(() => {
      expect(onDeleteTbm).toHaveBeenCalledWith("t1");
    });
  });

  it("renders list fallbacks and attendee empty state", () => {
    mockUseTbmRecord.mockReturnValue({
      data: {
        attendeeCount: 0,
        attendees: [],
      },
    } as never);

    render(
      <TbmList
        tbmRecords={[
          {
            leaderName: null,
            attendeeCount: 0,
            tbm: {
              id: "t-fallback",
              date: "2026-02-01",
              topic: "점검",
              topicCategory: "UNKNOWN_CATEGORY" as TbmTopicCategory,
              weatherCondition: null,
            },
          },
        ]}
        isLoading={false}
        onEditTbm={vi.fn()}
        onDeleteTbm={vi.fn().mockResolvedValue(undefined)}
        deleteMutation={{ isPending: false }}
      />,
    );

    expect(screen.getByText("UNKNOWN_CATEGORY")).toBeInTheDocument();
    expect(screen.getByText("0명")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "참석자 보기" }));
    expect(screen.getByText("참석자가 없습니다.")).toBeInTheDocument();
  });

  it("opens attendee count and closes ai/minutes dialogs", () => {
    render(
      <TbmList
        tbmRecords={[
          {
            leaderName: "팀장",
            attendeeCount: 1,
            tbm: {
              id: "t-dialog",
              date: "2026-02-01",
              topic: "대화상자 점검",
              topicCategory: TbmTopicCategory.GENERAL,
              weatherCondition: "맑음",
            },
          },
        ]}
        isLoading={false}
        onEditTbm={vi.fn()}
        onDeleteTbm={vi.fn().mockResolvedValue(undefined)}
        deleteMutation={{ isPending: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "1명" }));
    expect(
      screen.getByRole("heading", { name: /참석자 목록/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));
    expect(screen.getByText("대화상자 점검 - AI 분석")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "dialog-close" })[1]);

    fireEvent.click(screen.getByRole("button", { name: "회의록" }));
    expect(screen.getByText("대화상자 점검 - 회의록")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "dialog-close" })[1]);
  });
});
