import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CriteriaTab } from "../criteria-tab";
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useUpdatePolicy,
} from "@/hooks/use-points-api";

const { mockUseAuthStore } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
}));

const createMutateMock = vi.fn();
const updateMutateMock = vi.fn();
const deleteMutateMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock("@/hooks/use-points-api", () => ({
  usePolicies: vi.fn(),
  useCreatePolicy: vi.fn(),
  useUpdatePolicy: vi.fn(),
  useDeletePolicy: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    data,
    columns,
    emptyMessage,
  }: {
    data: Array<Record<string, unknown>>;
    columns: Array<{
      key: string;
      header: string;
      render?: (row: Record<string, unknown>) => ReactNode;
    }>;
    emptyMessage: string;
  }) => (
    <div>
      <div data-testid="headers">
        {columns.map((column) => (
          <span key={column.key}>{column.header}</span>
        ))}
      </div>
      {data.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        data.map((row) => (
          <div key={String(row.id)}>
            {columns.map((column) => (
              <div key={`${String(row.id)}-${column.key}`}>
                {column.render
                  ? column.render(row)
                  : String(row[column.key] ?? "")}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props}>
      {children}
    </button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog">
        <button type="button" onClick={() => onOpenChange?.(false)}>
          dialog-close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
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
  }) =>
    open ? (
      <div data-testid="alert-dialog">
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
    <h4>{children}</h4>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const mockUsePolicies = vi.mocked(usePolicies);
const mockUseCreatePolicy = vi.mocked(useCreatePolicy);
const mockUseUpdatePolicy = vi.mocked(useUpdatePolicy);
const mockUseDeletePolicy = vi.mocked(useDeletePolicy);

const policyRows = [
  {
    id: "p1",
    reasonCode: "REWARD",
    name: "포상 포인트",
    defaultAmount: 10,
    minAmount: 1,
    maxAmount: 100,
    dailyLimit: 10,
    monthlyLimit: 100,
    isActive: true,
  },
  {
    id: "p2",
    reasonCode: "BONUS",
    name: "추가 포인트",
    defaultAmount: 0,
    minAmount: null,
    maxAmount: null,
    dailyLimit: null,
    monthlyLimit: null,
    isActive: false,
  },
];

describe("criteria tab", () => {
  beforeEach(() => {
    createMutateMock.mockReset();
    updateMutateMock.mockReset();
    deleteMutateMock.mockReset();

    mockUseAuthStore.mockImplementation(
      (selector: (s: { currentSiteId: string | null }) => string | null) =>
        selector({ currentSiteId: "site-1" }),
    );

    mockUsePolicies.mockReturnValue({
      data: policyRows,
    } as never);
    mockUseCreatePolicy.mockReturnValue({
      mutate: createMutateMock,
      isPending: false,
    } as never);
    mockUseUpdatePolicy.mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as never);
    mockUseDeletePolicy.mockReturnValue({
      mutate: deleteMutateMock,
      isPending: false,
    } as never);
  });

  it("renders table branches for limits and active status", () => {
    render(<CriteriaTab />);

    expect(screen.getByText("포상 기준 설정")).toBeInTheDocument();
    expect(screen.getByText("포상 포인트")).toBeInTheDocument();
    expect(screen.getByText("추가 포인트")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("비활성")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getByTestId("headers")).toBeInTheDocument();
  });

  it("creates a policy with optional numeric fields and resets on success", async () => {
    render(<CriteriaTab />);

    fireEvent.click(screen.getByRole("button", { name: "+ 기준 추가" }));
    fireEvent.change(screen.getByPlaceholderText("예: SAFETY_REPORT"), {
      target: { value: "SAFE" },
    });
    fireEvent.change(screen.getByPlaceholderText("예: 안전 제보 포인트"), {
      target: { value: "안전 포인트" },
    });

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "11" } });
    fireEvent.change(numberInputs[1], { target: { value: "1" } });
    fireEvent.change(numberInputs[2], { target: { value: "99" } });
    fireEvent.change(numberInputs[3], { target: { value: "7" } });
    fireEvent.change(numberInputs[4], { target: { value: "70" } });

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalledTimes(1);
    });

    const createCall = createMutateMock.mock.calls[0] as [
      {
        siteId: string;
        reasonCode: string;
        name: string;
        defaultAmount: number;
        minAmount?: number;
        maxAmount?: number;
        dailyLimit?: number;
        monthlyLimit?: number;
      },
      { onSuccess: () => void },
    ];

    expect(createCall[0]).toEqual(
      expect.objectContaining({
        siteId: "site-1",
        reasonCode: "SAFE",
        name: "안전 포인트",
        defaultAmount: 11,
        minAmount: 1,
        maxAmount: 99,
        dailyLimit: 7,
        monthlyLimit: 70,
      }),
    );

    act(() => {
      createCall[1].onSuccess();
    });

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("updates a policy and omits empty optional values", async () => {
    render(<CriteriaTab />);

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]);
    expect(screen.getByPlaceholderText("예: SAFETY_REPORT")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("예: 안전 제보 포인트"), {
      target: { value: "수정된 정책" },
    });

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "0" } });
    fireEvent.change(numberInputs[1], { target: { value: "" } });
    fireEvent.change(numberInputs[2], { target: { value: "" } });
    fireEvent.change(numberInputs[3], { target: { value: "" } });
    fireEvent.change(numberInputs[4], { target: { value: "" } });

    const saveButtons = screen.getAllByRole("button", { name: "수정" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(updateMutateMock).toHaveBeenCalledTimes(1);
    });

    const updateCall = updateMutateMock.mock.calls[0] as [
      {
        id: string;
        data: {
          name: string;
          defaultAmount: number;
          minAmount?: number;
          maxAmount?: number;
          dailyLimit?: number;
          monthlyLimit?: number;
        };
      },
      { onSuccess: () => void },
    ];

    expect(updateCall[0].id).toBe("p1");
    expect(updateCall[0].data).toEqual(
      expect.objectContaining({
        name: "수정된 정책",
        defaultAmount: 0,
      }),
    );
    expect(updateCall[0].data.minAmount).toBeUndefined();
    expect(updateCall[0].data.maxAmount).toBeUndefined();
    expect(updateCall[0].data.dailyLimit).toBeUndefined();
    expect(updateCall[0].data.monthlyLimit).toBeUndefined();

    act(() => {
      updateCall[1].onSuccess();
    });

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("does not submit when site id is missing", () => {
    mockUseAuthStore.mockImplementation(
      (selector: (s: { currentSiteId: string | null }) => string | null) =>
        selector({ currentSiteId: null }),
    );

    render(<CriteriaTab />);
    fireEvent.click(screen.getByRole("button", { name: "+ 기준 추가" }));
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(createMutateMock).not.toHaveBeenCalled();
    expect(updateMutateMock).not.toHaveBeenCalled();
  });

  it("handles delete dialog close and confirm paths", async () => {
    render(<CriteriaTab />);

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "alert-close" }));
    expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    const alertDeleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(alertDeleteButtons[alertDeleteButtons.length - 1]);

    expect(deleteMutateMock).toHaveBeenCalledTimes(1);
    expect(deleteMutateMock).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );

    const deleteCall = deleteMutateMock.mock.calls[0] as [
      string,
      { onSettled: () => void },
    ];
    act(() => {
      deleteCall[1].onSettled();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();
    });
  });

  it("disables save and delete actions while pending", async () => {
    mockUseCreatePolicy.mockReturnValue({
      mutate: createMutateMock,
      isPending: true,
    } as never);
    mockUseUpdatePolicy.mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as never);
    mockUseDeletePolicy.mockReturnValue({
      mutate: deleteMutateMock,
      isPending: true,
    } as never);

    render(<CriteriaTab />);
    fireEvent.click(screen.getByRole("button", { name: "+ 기준 추가" }));
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "삭제 중..." })).toBeDisabled();
    });
  });
});
