import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PointsPage from "../page";
import { useAwardPoints, useMembers, usePointsLedger } from "@/hooks/use-api";

const mutateMock = vi.fn();
const toastMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/points",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
    >
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    type,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    type?: string;
  }) => (
    <input
      value={value}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value } })
      }
      placeholder={placeholder}
      type={type}
    />
  ),
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    columns,
    data,
    emptyMessage,
    searchPlaceholder,
  }: {
    columns: Array<{
      key: string;
      render?: (item: Record<string, unknown>) => ReactNode;
      header: string;
    }>;
    data: Array<Record<string, unknown>>;
    emptyMessage: string;
    searchPlaceholder?: string;
    searchable?: boolean;
  }) => (
    <div>
      <p>{searchPlaceholder}</p>
      <p>{emptyMessage}</p>
      {data.map((row) => (
        <div key={String(row.id)}>
          {columns.map((column) => (
            <div key={`${String(row.id)}-${column.key}`}>
              {column.render?.(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/hooks/use-api", () => ({
  usePointsLedger: vi.fn(),
  useMembers: vi.fn(),
  useAwardPoints: vi.fn(),
}));

const mockUsePointsLedger = vi.mocked(usePointsLedger);
const mockUseMembers = vi.mocked(useMembers);
const mockUseAwardPoints = vi.mocked(useAwardPoints);

describe("PointsPage", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    toastMock.mockReset();

    mockUsePointsLedger.mockReturnValue({
      data: [
        {
          id: "l1",
          userId: "u1",
          amount: 200,
          reasonCode: "SAFE",
          reasonText: "안전 제보",
          createdAt: "2026-01-01T00:00:00.000Z",
          userName: "홍길동",
        },
        {
          id: "l2",
          userId: "u2",
          amount: -50,
          reasonCode: "PENALTY",
          reasonText: null,
          createdAt: "2026-01-02T00:00:00.000Z",
          userName: null,
        },
      ],
      isLoading: false,
    } as never);

    mockUseMembers.mockReturnValue({
      data: [
        { user: { id: "u1", name: "홍길동" } },
        { user: { id: "u2", name: "임꺽정" } },
      ],
    } as never);

    mockUseAwardPoints.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as never);
  });

  it("renders page links, ledger cells, and loading fallback text", () => {
    render(<PointsPage />);

    expect(screen.getByText("포인트 관리")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "월말 정산" })).toHaveAttribute(
      "href",
      "/points/settlement",
    );
    expect(
      screen.getByRole("link", { name: "포인트 정책 관리" }),
    ).toHaveAttribute("href", "/points/policies");

    expect(screen.getByText("+200")).toBeInTheDocument();
    expect(screen.getByText("-50")).toBeInTheDocument();
    expect(screen.getByText("안전 제보")).toBeInTheDocument();
    expect(screen.getByText("PENALTY")).toBeInTheDocument();
    expect(screen.getByText("알 수 없음")).toBeInTheDocument();
    expect(screen.getByText("회원, 사유 검색...")).toBeInTheDocument();
  });

  it("disables award button until all inputs are provided", () => {
    render(<PointsPage />);

    const awardButton = screen.getByRole("button", { name: "지급" });
    expect(awardButton).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "u1" } });
    fireEvent.change(screen.getByPlaceholderText("포인트"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByPlaceholderText("지급 사유"), {
      target: { value: "테스트" },
    });
    expect(awardButton).not.toBeDisabled();
  });

  it("submits award and resets form on success", async () => {
    mutateMock.mockImplementation(
      (
        _payload: { userId: string; amount: number; reason: string },
        options: { onSuccess?: () => void },
      ) => options.onSuccess?.(),
    );

    render(<PointsPage />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "u1" } });
    fireEvent.change(screen.getByPlaceholderText("포인트"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByPlaceholderText("지급 사유"), {
      target: { value: "안전 활동" },
    });
    fireEvent.click(screen.getByRole("button", { name: "지급" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { userId: "u1", amount: 30, reason: "안전 활동" },
        expect.objectContaining({}),
      );
      expect(toastMock).toHaveBeenCalledWith({
        title: "포인트가 지급되었습니다.",
      });
    });

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByPlaceholderText("포인트")).toHaveValue(null);
    expect(screen.getByPlaceholderText("지급 사유")).toHaveValue("");
  });

  it("shows error toast for Error and unknown error values", async () => {
    mutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; amount: number; reason: string },
        options: { onError?: (error: unknown) => void },
      ) => options.onError?.(new Error("실패")),
    );

    render(<PointsPage />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "u1" } });
    fireEvent.change(screen.getByPlaceholderText("포인트"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByPlaceholderText("지급 사유"), {
      target: { value: "사유" },
    });
    fireEvent.click(screen.getByRole("button", { name: "지급" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "실패",
          variant: "destructive",
        }),
      );
    });

    mutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; amount: number; reason: string },
        options: { onError?: (error: unknown) => void },
      ) => options.onError?.("unknown"),
    );
    fireEvent.click(screen.getByRole("button", { name: "지급" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "포인트 지급 중 오류가 발생했습니다.",
          variant: "destructive",
        }),
      );
    });
  });

  it("shows pending state label and disabled button", () => {
    mockUseAwardPoints.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
    } as never);

    render(<PointsPage />);

    expect(screen.getByRole("button", { name: "처리 중..." })).toBeDisabled();
    expect(screen.getByText("포인트 내역이 없습니다")).toBeInTheDocument();
  });
});
