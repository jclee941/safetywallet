import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatUnixDate,
  getContentTypeLabel,
  getErrorMessage,
  getQuizStatusLabel,
  getTrainingStatusLabel,
  getTrainingTypeLabel,
  tabItems,
} from "../../education-helpers";
import { ContentCompletions } from "../content-completions";
import { TrainingForm } from "../statutory-tab/training-form";
import { useEducationCompletions } from "@/hooks/use-education-completions";

vi.mock("@/hooks/use-education-completions", () => ({
  useEducationCompletions: vi.fn(),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
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
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockUseEducationCompletions = vi.mocked(useEducationCompletions);

describe("education helpers", () => {
  it("maps labels and fallback values", () => {
    expect(tabItems).toHaveLength(4);
    expect(getContentTypeLabel("VIDEO")).toBe("동영상");
    expect(getContentTypeLabel("IMAGE")).toBe("이미지");
    expect(getContentTypeLabel("TEXT")).toBe("텍스트");
    expect(getContentTypeLabel("DOCUMENT")).toBe("문서");

    expect(getQuizStatusLabel("DRAFT")).toBe("초안");
    expect(getQuizStatusLabel("PUBLISHED")).toBe("게시");
    expect(getQuizStatusLabel("ARCHIVED")).toBe("보관");

    expect(getTrainingTypeLabel("NEW_WORKER")).toBe("신규채용");
    expect(getTrainingTypeLabel("SPECIAL")).toBe("특별교육");
    expect(getTrainingTypeLabel("REGULAR")).toBe("정기교육");
    expect(getTrainingTypeLabel("CHANGE_OF_WORK")).toBe("작업변경");

    expect(getTrainingStatusLabel("SCHEDULED")).toBe("예정");
    expect(getTrainingStatusLabel("COMPLETED")).toBe("완료");
    expect(getTrainingStatusLabel("EXPIRED")).toBe("만료");
  });

  it("formats errors and unix dates", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("bad")).toBe("요청 처리 중 오류가 발생했습니다.");

    expect(formatUnixDate(undefined)).toBe("-");
    expect(formatUnixDate(null)).toBe("-");
    expect(formatUnixDate("2026-01-01")).toBe("2026-01-01");
    expect(formatUnixDate(0)).toMatch(/1970|70/);
  });
});

describe("content completions", () => {
  beforeEach(() => {
    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, total: 0, limit: 50, totalPages: 0 },
      },
      isLoading: false,
    } as never);
  });

  it("renders loading state", () => {
    mockUseEducationCompletions.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as never);

    render(
      <ContentCompletions
        contents={[
          {
            id: "c1",
            title: "교육 A",
            contentType: "TEXT",
            createdAt: "2026-01-01",
          },
        ]}
      />,
    );

    expect(screen.getByText("수료 내역")).toBeInTheDocument();
    expect(
      screen.getByText("교육 자료별 수료자와 서명 시간을 확인할 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("renders empty state and updates filters", () => {
    render(
      <ContentCompletions
        contents={[
          {
            id: "c1",
            title: "교육 A",
            contentType: "TEXT",
            createdAt: "2026-01-01",
          },
          {
            id: "c2",
            title: "교육 B",
            contentType: "VIDEO",
            createdAt: "2026-01-02",
          },
        ]}
      />,
    );

    expect(screen.getByText("수료 기록이 없습니다.")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "c2" } });
    const dates = screen.getAllByDisplayValue("");
    fireEvent.change(dates[0], { target: { value: "2026-02-01" } });
    fireEvent.change(dates[1], { target: { value: "2026-02-28" } });

    expect(mockUseEducationCompletions).toHaveBeenCalled();
  });

  it("renders completion rows with signature and fallbacks", () => {
    mockUseEducationCompletions.mockReturnValue({
      data: {
        items: [
          {
            id: "r1",
            userName: "홍길동",
            userCompany: "안전건설",
            signedAt: "2026-02-01T10:00:00.000Z",
            signatureData: "data:image/png;base64,abc",
          },
          {
            id: "r2",
            userName: null,
            userCompany: null,
            signedAt: null,
            signatureData: null,
          },
        ],
        pagination: { page: 1, total: 2, limit: 50, totalPages: 1 },
      },
      isLoading: false,
    } as never);

    render(
      <ContentCompletions
        contents={[
          {
            id: "c1",
            title: "교육 A",
            contentType: "TEXT",
            createdAt: "2026-01-01",
          },
        ]}
      />,
    );

    expect(screen.getByText(/총\s*2건/)).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByAltText("서명")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});

describe("training form", () => {
  it("updates all fields and supports edit/cancel", () => {
    const setTrainingForm = vi.fn();
    const onSubmitTraining = vi.fn();
    const onCancel = vi.fn();

    render(
      <TrainingForm
        trainingForm={{
          userId: "u1",
          trainingType: "NEW_WORKER",
          trainingName: "신규 교육",
          trainingDate: "2026-03-01",
          expirationDate: "",
          provider: "",
          hoursCompleted: "1",
          status: "SCHEDULED",
          notes: "",
        }}
        setTrainingForm={setTrainingForm}
        editingTrainingId="t1"
        onSubmitTraining={onSubmitTraining}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("법정교육 수정")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("대상자 사용자 ID")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "정기 교육" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육기관"), {
      target: { value: "KOSHA" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "SPECIAL" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "COMPLETED" },
    });
    fireEvent.change(screen.getByDisplayValue("2026-03-01"), {
      target: { value: "2026-03-11" },
    });
    fireEvent.change(screen.getByDisplayValue("1"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByPlaceholderText("비고"), {
      target: { value: "메모" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(setTrainingForm).toHaveBeenCalled();
    expect(onSubmitTraining).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders create mode label", () => {
    render(
      <TrainingForm
        trainingForm={{
          userId: "",
          trainingType: "SPECIAL",
          trainingName: "",
          trainingDate: "",
          expirationDate: "",
          provider: "",
          hoursCompleted: "0",
          status: "COMPLETED",
          notes: "",
        }}
        setTrainingForm={vi.fn()}
        editingTrainingId={null}
        onSubmitTraining={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByText("법정교육 등록").length).toBeGreaterThan(0);
  });
});
