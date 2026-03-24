import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VotePeriodCard } from "../vote-period-card";
import { useVotePeriod, useUpdateVotePeriod } from "@/hooks/use-votes";
import {
  epochToKstDateString,
  getPeriodStatus,
  dateStringToKstEpoch,
} from "../../votes-helpers";

const mutateAsyncMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/hooks/use-votes", () => ({
  useVotePeriod: vi.fn(),
  useUpdateVotePeriod: vi.fn(),
}));

vi.mock("../../votes-helpers", () => ({
  epochToKstDateString: vi.fn((epoch: string) => {
    const map: Record<string, string> = {
      "1706742000": "2024-02-01",
      "1709251200": "2024-03-01",
    };
    return map[epoch] || "";
  }),
  dateStringToKstEpoch: vi.fn((date: string) => date),
  getPeriodStatus: vi.fn(() => "ENDED"),
  PERIOD_STATUS_CONFIG: {
    ACTIVE: { label: "ACTIVE", className: "" },
    UPCOMING: { label: "UPCOMING", className: "" },
    ENDED: { label: "ENDED", className: "" },
  },
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  useToast: () => ({ toast: toastMock }),
}));

const mockUseVotePeriod = vi.mocked(useVotePeriod);
const mockUseUpdateVotePeriod = vi.mocked(useUpdateVotePeriod);
const mockEpochToKstDateString = vi.mocked(epochToKstDateString);
const mockGetPeriodStatus = vi.mocked(getPeriodStatus);
const mockDateStringToKstEpoch = vi.mocked(dateStringToKstEpoch);

describe("vote period card", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    toastMock.mockReset();
    mockEpochToKstDateString.mockClear();
    mockGetPeriodStatus.mockReturnValue("ENDED");
    mockDateStringToKstEpoch.mockClear();
    mockUseVotePeriod.mockReturnValue({
      data: { startDate: "1706742000", endDate: "1709251200" },
    } as never);
    mockUseUpdateVotePeriod.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as never);
  });

  it("renders period dates and status", () => {
    render(<VotePeriodCard month="2026-02" />);
    expect(screen.getByText("투표 기간 설정")).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE|UPCOMING|ENDED/)).toBeInTheDocument();
  });

  it("submits updated period", async () => {
    mutateAsyncMock.mockResolvedValueOnce({});
    render(<VotePeriodCard month="2026-02" />);

    // Wait for useEffect to populate dates from mocked epochToKstDateString
    await waitFor(() => {
      expect(screen.getByLabelText("종료일")).toHaveValue("2024-03-01");
    });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ month: "2026-02" }),
      );
    });
  });

  it("shows error toast when update fails", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("저장 실패"));
    render(<VotePeriodCard month="2026-02" />);

    // Wait for useEffect to populate valid dates before clicking save
    await waitFor(() => {
      expect(screen.getByLabelText("종료일")).toHaveValue("2024-03-01");
    });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      );
    });
  });

  it("clears dates when period data is missing", () => {
    mockUseVotePeriod.mockReturnValueOnce({ data: undefined } as never);
    render(<VotePeriodCard month="2026-02" />);

    expect(screen.getByLabelText("시작일")).toHaveValue("");
    expect(screen.getByLabelText("종료일")).toHaveValue("");
  });

  it("does not submit when either date is empty", () => {
    mockUseVotePeriod.mockReturnValue({
      data: { startDate: "1706742000", endDate: "unknown" },
    } as never);
    render(<VotePeriodCard month="2026-02" />);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("updates start and end date inputs via onChange", () => {
    render(<VotePeriodCard month="2026-02" />);

    fireEvent.change(screen.getByLabelText("시작일"), {
      target: { value: "2026-02-10" },
    });
    fireEvent.change(screen.getByLabelText("종료일"), {
      target: { value: "2026-02-20" },
    });

    expect(screen.getByLabelText("시작일")).toHaveValue("2026-02-10");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-02-20");
  });

  it("hides badge when status is null", () => {
    mockGetPeriodStatus.mockReturnValue(null as never);
    render(<VotePeriodCard month="2026-02" />);

    expect(screen.queryByText("ENDED")).not.toBeInTheDocument();
  });

  it("shows pending save state", () => {
    mockUseUpdateVotePeriod.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: true,
    } as never);

    render(<VotePeriodCard month="2026-02" />);
    expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled();
  });
});
