import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatutoryTab } from "../statutory-tab";
import { TrainingForm } from "../statutory-tab/training-form";
import {
  useCreateStatutoryTraining,
  useDeleteStatutoryTraining,
  useStatutoryTrainings,
  useUpdateStatutoryTraining,
} from "@/hooks/use-api";
import type { TrainingFormState } from "../education-types";

const toastMock = vi.fn();
const createAsyncMock = vi.fn();
const updateAsyncMock = vi.fn();
const deleteAsyncMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useCreateStatutoryTraining: vi.fn(),
  useDeleteStatutoryTraining: vi.fn(),
  useStatutoryTrainings: vi.fn(),
  useUpdateStatutoryTraining: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          alert-close
        </button>
        {children}
      </div>
    ) : null,
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
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
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
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  useToast: () => ({ toast: toastMock }),
}));

const mockUseStatutoryTrainings = vi.mocked(useStatutoryTrainings);
const mockUseCreateStatutoryTraining = vi.mocked(useCreateStatutoryTraining);
const mockUseUpdateStatutoryTraining = vi.mocked(useUpdateStatutoryTraining);
const mockUseDeleteStatutoryTraining = vi.mocked(useDeleteStatutoryTraining);

describe("statutory tab", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createAsyncMock.mockReset();
    updateAsyncMock.mockReset();
    deleteAsyncMock.mockReset();

    mockUseStatutoryTrainings.mockReturnValue({
      data: {
        trainings: [
          {
            training: {
              id: "t1",
              userId: "u1",
              trainingType: "NEW_WORKER",
              trainingName: "신규자 교육",
              trainingDate: "2026-02-01",
              expirationDate: null,
              provider: null,
              hoursCompleted: 2,
              status: "SCHEDULED",
              notes: null,
            },
            userName: "홍길동",
          },
        ],
      },
      isLoading: false,
    } as never);
    mockUseCreateStatutoryTraining.mockReturnValue({
      mutateAsync: createAsyncMock,
    } as never);
    mockUseUpdateStatutoryTraining.mockReturnValue({
      mutateAsync: updateAsyncMock,
    } as never);
    mockUseDeleteStatutoryTraining.mockReturnValue({
      mutateAsync: deleteAsyncMock,
      isPending: false,
    } as never);
  });

  it("creates statutory training", async () => {
    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: /교육 등록/ }));

    fireEvent.change(screen.getByPlaceholderText("대상자 사용자 ID"), {
      target: { value: "u1" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "정기 안전교육" },
    });
    fireEvent.change(screen.getAllByDisplayValue("")[0], {
      target: { value: "2026-02-01" },
    });

    fireEvent.click(screen.getByRole("button", { name: "법정교육 등록" }));
    await waitFor(() => {
      expect(createAsyncMock).toHaveBeenCalled();
    });
  });

  it("does not submit when required fields are missing", async () => {
    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: /교육 등록/ }));
    fireEvent.click(screen.getByRole("button", { name: "법정교육 등록" }));

    await waitFor(() => {
      expect(createAsyncMock).not.toHaveBeenCalled();
      expect(updateAsyncMock).not.toHaveBeenCalled();
    });
  });

  it("loads list and enters edit mode", () => {
    render(<StatutoryTab />);
    expect(screen.getByText("신규자 교육")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(
      screen.getByRole("button", { name: "수정 저장" }),
    ).toBeInTheDocument();
  });

  it("updates statutory training", async () => {
    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "수정 교육" },
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => {
      expect(updateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1" }),
      );
    });
  });

  it("shows destructive toast when create or update fails", async () => {
    createAsyncMock.mockRejectedValueOnce(new Error("create failed"));
    updateAsyncMock.mockRejectedValueOnce(new Error("update failed"));

    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: /교육 등록/ }));
    fireEvent.change(screen.getByPlaceholderText("대상자 사용자 ID"), {
      target: { value: "u1" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "신규 교육" },
    });
    fireEvent.change(screen.getAllByDisplayValue("")[0], {
      target: { value: "2026-03-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "법정교육 등록" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "create failed",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "update failed",
        }),
      );
    });
  });

  it("toggles form with header button", () => {
    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: /교육 등록/ }));
    expect(screen.getAllByText("법정교육 등록").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(screen.queryByText("법정교육 등록")).not.toBeInTheDocument();
  });

  it("handles delete success and error paths", async () => {
    render(<StatutoryTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");

    fireEvent.click(iconButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteAsyncMock).toHaveBeenCalledWith("t1");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "법정교육이 삭제되었습니다." }),
      );
    });

    deleteAsyncMock.mockRejectedValueOnce(new Error("delete failed"));
    fireEvent.click(iconButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "delete failed",
        }),
      );
    });
  });

  it("converts unix dates while entering edit mode", () => {
    mockUseStatutoryTrainings.mockReturnValueOnce({
      data: {
        trainings: [
          {
            training: {
              id: "t2",
              userId: "u2",
              trainingType: "REGULAR",
              trainingName: "정기 교육",
              trainingDate: 1738368000,
              expirationDate: "1738454400",
              provider: "기관",
              hoursCompleted: 3,
              status: "COMPLETED",
              notes: "메모",
            },
            userName: "김철수",
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    const dateInputs = document.querySelectorAll("input[type='date']");

    expect((dateInputs[0] as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    expect((dateInputs[1] as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("falls back to empty date input for invalid date values", () => {
    mockUseStatutoryTrainings.mockReturnValueOnce({
      data: {
        trainings: [
          {
            training: {
              id: "t3",
              userId: "u3",
              trainingType: "SPECIAL",
              trainingName: "특별 교육",
              trainingDate: "invalid-date",
              expirationDate: "also-invalid",
              provider: null,
              hoursCompleted: 1,
              status: "SCHEDULED",
              notes: null,
            },
            userName: "박영희",
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<StatutoryTab />);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    const dateInputs = document.querySelectorAll("input[type='date']");
    expect((dateInputs[0] as HTMLInputElement).value).toBe("");
    expect((dateInputs[1] as HTMLInputElement).value).toBe("");
  });

  it("closes and resets edit form when cancel is clicked", () => {
    render(<StatutoryTab />);

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(
      screen.queryByRole("button", { name: "수정 저장" }),
    ).not.toBeInTheDocument();
  });

  it("closes delete dialog without deleting when dismissed", async () => {
    render(<StatutoryTab />);

    const iconButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent === "");

    fireEvent.click(iconButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "alert-close" }));

    await waitFor(() => {
      expect(screen.queryByText("법정교육 삭제")).not.toBeInTheDocument();
      expect(deleteAsyncMock).not.toHaveBeenCalled();
    });
  });

  it("shows training list loading state", () => {
    mockUseStatutoryTrainings.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as never);

    render(<StatutoryTab />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });
});

describe("training form subcomponent", () => {
  it("updates all form controls with live state", () => {
    function Harness() {
      const [trainingForm, setTrainingForm] = useState<TrainingFormState>({
        userId: "",
        trainingType: "NEW_WORKER",
        trainingName: "",
        trainingDate: "",
        expirationDate: "",
        provider: "",
        hoursCompleted: "0",
        status: "SCHEDULED",
        notes: "",
      });

      return (
        <TrainingForm
          trainingForm={trainingForm}
          setTrainingForm={setTrainingForm}
          editingTrainingId={null}
          onSubmitTraining={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText("대상자 사용자 ID"), {
      target: { value: "u-live" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "현장 교육" },
    });
    const dateInputs = document.querySelectorAll("input[type='date']");
    fireEvent.change(dateInputs[0], { target: { value: "2026-06-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByPlaceholderText("이수시간"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육기관"), {
      target: { value: "안전원" },
    });
    fireEvent.change(screen.getByPlaceholderText("비고"), {
      target: { value: "실습 포함" },
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "SPECIAL" } });
    fireEvent.change(selects[1], { target: { value: "COMPLETED" } });

    expect(screen.getByDisplayValue("u-live")).toBeInTheDocument();
    expect(screen.getByDisplayValue("현장 교육")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-06-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-12-31")).toBeInTheDocument();
    expect(screen.getByDisplayValue("6")).toBeInTheDocument();
    expect(screen.getByDisplayValue("안전원")).toBeInTheDocument();
    expect(screen.getByDisplayValue("실습 포함")).toBeInTheDocument();
    expect(selects[0]).toHaveValue("SPECIAL");
    expect(selects[1]).toHaveValue("COMPLETED");
  });

  it("updates date, provider, notes and submits in create mode", () => {
    const setTrainingForm = vi.fn();
    const onSubmitTraining = vi.fn();

    render(
      <TrainingForm
        trainingForm={{
          userId: "",
          trainingType: "NEW_WORKER",
          trainingName: "",
          trainingDate: "",
          expirationDate: "",
          provider: "",
          hoursCompleted: "",
          status: "SCHEDULED",
          notes: "",
        }}
        setTrainingForm={setTrainingForm}
        editingTrainingId={null}
        onSubmitTraining={onSubmitTraining}
        onCancel={vi.fn()}
      />,
    );

    const dateInputs = document.querySelectorAll("input[type='date']");
    fireEvent.change(dateInputs[0], { target: { value: "2026-03-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-12-31" } });

    fireEvent.change(screen.getByPlaceholderText("교육기관"), {
      target: { value: "안전교육원" },
    });
    fireEvent.change(screen.getByPlaceholderText("비고"), {
      target: { value: "메모" },
    });

    fireEvent.click(screen.getByRole("button", { name: "법정교육 등록" }));

    expect(setTrainingForm).toHaveBeenCalled();
    expect(onSubmitTraining).toHaveBeenCalledTimes(1);
  });

  it("updates every training field through setTrainingForm updaters", () => {
    const setTrainingForm = vi.fn();

    render(
      <TrainingForm
        trainingForm={{
          userId: "",
          trainingType: "NEW_WORKER",
          trainingName: "",
          trainingDate: "",
          expirationDate: "",
          provider: "",
          hoursCompleted: "",
          status: "SCHEDULED",
          notes: "",
        }}
        setTrainingForm={setTrainingForm}
        editingTrainingId={null}
        onSubmitTraining={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("대상자 사용자 ID"), {
      target: { value: "u100" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육명"), {
      target: { value: "법정 교육" },
    });

    const dateInputs = document.querySelectorAll("input[type='date']");
    fireEvent.change(dateInputs[0], { target: { value: "2026-04-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-05-01" } });

    fireEvent.change(screen.getByPlaceholderText("이수시간"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByPlaceholderText("교육기관"), {
      target: { value: "기관A" },
    });
    fireEvent.change(screen.getByPlaceholderText("비고"), {
      target: { value: "메모A" },
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "CHANGE_OF_WORK" } });
    fireEvent.change(selects[1], { target: { value: "EXPIRED" } });

    expect(setTrainingForm.mock.calls.length).toBeGreaterThanOrEqual(9);

    const typeUpdater = setTrainingForm.mock.calls[7][0] as (
      prev: Record<string, string>,
    ) => Record<string, string>;
    const statusUpdater = setTrainingForm.mock.calls[8][0] as (
      prev: Record<string, string>,
    ) => Record<string, string>;

    expect(
      typeUpdater({ trainingType: "NEW_WORKER", status: "SCHEDULED" }),
    ).toMatchObject({ trainingType: "CHANGE_OF_WORK" });
    expect(
      statusUpdater({ trainingType: "CHANGE_OF_WORK", status: "SCHEDULED" }),
    ).toMatchObject({ status: "EXPIRED" });
  });

  it("disables user id and shows cancel in edit mode", () => {
    const onCancel = vi.fn();

    render(
      <TrainingForm
        trainingForm={{
          userId: "u1",
          trainingType: "SPECIAL",
          trainingName: "교육",
          trainingDate: "2026-03-01",
          expirationDate: "2026-12-31",
          provider: "기관",
          hoursCompleted: "2",
          status: "COMPLETED",
          notes: "",
        }}
        setTrainingForm={vi.fn()}
        editingTrainingId="t1"
        onSubmitTraining={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByPlaceholderText("대상자 사용자 ID")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("updates trainingType and status through select controls", () => {
    const setTrainingForm = vi.fn();

    render(
      <TrainingForm
        trainingForm={{
          userId: "u1",
          trainingType: "NEW_WORKER",
          trainingName: "교육",
          trainingDate: "2026-03-01",
          expirationDate: "2026-12-31",
          provider: "기관",
          hoursCompleted: "2",
          status: "SCHEDULED",
          notes: "",
        }}
        setTrainingForm={setTrainingForm}
        editingTrainingId={null}
        onSubmitTraining={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "SPECIAL" } });
    fireEvent.change(selects[1], { target: { value: "COMPLETED" } });

    const setTrainingType = setTrainingForm.mock.calls[0][0] as (prev: {
      trainingType: string;
      status: string;
    }) => { trainingType: string; status: string };
    const setStatus = setTrainingForm.mock.calls[1][0] as (prev: {
      trainingType: string;
      status: string;
    }) => { trainingType: string; status: string };

    expect(
      setTrainingType({ trainingType: "NEW_WORKER", status: "SCHEDULED" }),
    ).toMatchObject({ trainingType: "SPECIAL" });
    expect(
      setStatus({ trainingType: "SPECIAL", status: "SCHEDULED" }),
    ).toMatchObject({ status: "COMPLETED" });
  });
});
