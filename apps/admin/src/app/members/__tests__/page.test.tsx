import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MembersPage from "../page";
import {
  useMembers,
  useSetMemberActiveStatus,
  useToggleLoginExempt,
} from "@/hooks/use-api";

const pushMock = vi.fn();
const toastMock = vi.fn();
const setMemberActiveStatusMutateMock = vi.fn();
const toggleLoginExemptMutateMock = vi.fn();

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

type MemberRow = {
  id: string;
  user: { id: string; name: string; loginExempt?: boolean };
  status: string;
  role: string;
  joinedAt: string;
};

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
};

type DataTableProps = {
  columns: Column<MemberRow>[];
  data: MemberRow[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (item: MemberRow) => void;
  emptyMessage?: string;
};

const authState = {
  currentSiteId: "site-1" as string | null,
  _hasHydrated: true,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/members",
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: <T,>(selector: (state: typeof authState) => T) =>
    selector(authState),
}));

vi.mock("@safetywallet/ui", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick?.({ stopPropagation: vi.fn() })}
    >
      {children}
    </button>
  ),
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="status-dialog" data-open={open ? "true" : "false"}>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        close-dialog
      </button>
      {children}
    </div>
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
    <h2>{children}</h2>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  toast: (payload: unknown) => toastMock(payload),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: (props: DataTableProps) => {
    return (
      <div>
        <p>{props.emptyMessage}</p>
        <p>{props.searchPlaceholder}</p>
        <p>{props.searchable ? "searchable" : "not-searchable"}</p>

        {props.data.map((item) => (
          <div key={item.id} data-testid={`row-${item.id}`}>
            {props.columns.map((column) => (
              <div key={`${item.id}-${column.key}`}>
                {column.render
                  ? column.render(item)
                  : String(item[column.key as keyof MemberRow] ?? "")}
              </div>
            ))}
            <button type="button" onClick={() => props.onRowClick?.(item)}>
              row-click-{item.id}
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("@/hooks/use-api", () => ({
  useMembers: vi.fn(),
  useSetMemberActiveStatus: vi.fn(),
  useToggleLoginExempt: vi.fn(),
}));

const mockUseMembers = vi.mocked(useMembers);
const mockUseSetMemberActiveStatus = vi.mocked(useSetMemberActiveStatus);
const mockUseToggleLoginExempt = vi.mocked(useToggleLoginExempt);

const toMembersResult = (value: unknown): ReturnType<typeof useMembers> =>
  value as never;

const membersFixture: MemberRow[] = [
  {
    id: "member-1",
    user: { id: "user-1", name: "홍길동", loginExempt: true },
    status: "ACTIVE",
    role: "MANAGER",
    joinedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "member-2",
    user: { id: "user-2", name: "김철수" },
    status: "CUSTOM",
    role: "WORKER",
    joinedAt: "2026-03-02T00:00:00.000Z",
  },
];

describe("MembersPage (__tests__)", () => {
  beforeEach(() => {
    pushMock.mockReset();
    toastMock.mockReset();
    setMemberActiveStatusMutateMock.mockReset();
    toggleLoginExemptMutateMock.mockReset();

    authState.currentSiteId = "site-1";
    authState._hasHydrated = true;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: [],
        isLoading: false,
      }),
    );

    mockUseSetMemberActiveStatus.mockReturnValue({
      mutate: setMemberActiveStatusMutateMock,
      isPending: false,
    } as never);

    mockUseToggleLoginExempt.mockReturnValue({
      mutate: toggleLoginExemptMutateMock,
      isPending: false,
    } as never);
  });

  it("shows empty message variants for auth hydration and loading", () => {
    render(<MembersPage />, { wrapper: Wrapper });
    expect(screen.getByText("회원이 없습니다")).toBeInTheDocument();

    authState.currentSiteId = null;
    authState._hasHydrated = false;
    render(<MembersPage />, { wrapper: Wrapper });
    expect(
      screen.getByText("현장 정보를 준비하는 중입니다..."),
    ).toBeInTheDocument();

    authState.currentSiteId = "site-1";
    authState._hasHydrated = true;
    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: [],
        isLoading: true,
      }),
    );
    render(<MembersPage />, { wrapper: Wrapper });
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders table columns, fallback status label, and navigates to detail", () => {
    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: membersFixture,
        isLoading: false,
      }),
    );

    render(<MembersPage />, { wrapper: Wrapper });

    expect(screen.getByText("회원 관리")).toBeInTheDocument();
    expect(screen.getByText("searchable")).toBeInTheDocument();
    expect(screen.getByText("이름 검색...")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();

    const switches = screen.getAllByRole("checkbox");
    expect(switches[0]).toBeChecked();
    expect(switches[1]).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "row-click-member-2" }));
    expect(pushMock).toHaveBeenCalledWith("/members/member-2");
  });

  it("handles login exempt toggle success and error", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: membersFixture,
        isLoading: false,
      }),
    );

    toggleLoginExemptMutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; loginExempt: boolean },
        options?: { onSuccess?: () => void },
      ) => {
        options?.onSuccess?.();
      },
    );

    toggleLoginExemptMutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; loginExempt: boolean },
        options?: { onError?: (error: unknown) => void },
      ) => {
        options?.onError?.(new Error("toggle failed"));
      },
    );

    render(<MembersPage />, { wrapper: Wrapper });

    const switches = screen.getAllByRole("checkbox");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(toggleLoginExemptMutateMock).toHaveBeenNthCalledWith(
        1,
        { userId: "user-1", loginExempt: false },
        expect.any(Object),
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin", "members"],
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "홍길동 출석 예외가 비활성화되었습니다.",
        }),
      );
    });

    fireEvent.click(switches[1]);

    await waitFor(() => {
      expect(toggleLoginExemptMutateMock).toHaveBeenNthCalledWith(
        2,
        { userId: "user-2", loginExempt: true },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "출석 예외 변경 실패: toggle failed",
        }),
      );
    });
  });

  it("handles member status dialog guard, success, and error", async () => {
    mockUseMembers.mockReturnValue(
      toMembersResult({
        data: [membersFixture[0]],
        isLoading: false,
      }),
    );

    render(<MembersPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(setMemberActiveStatusMutateMock).not.toHaveBeenCalled();

    setMemberActiveStatusMutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; active: boolean },
        options?: { onSuccess?: () => void },
      ) => {
        options?.onSuccess?.();
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    expect(screen.getByText(/홍길동님을/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(setMemberActiveStatusMutateMock).toHaveBeenNthCalledWith(
        1,
        { userId: "user-1", active: false },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "홍길동 회원 상태가 비활성으로 변경되었습니다.",
        }),
      );
    });

    setMemberActiveStatusMutateMock.mockImplementationOnce(
      (
        _payload: { userId: string; active: boolean },
        options?: { onError?: (error: Error) => void },
      ) => {
        options?.onError?.(new Error("update failed"));
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(setMemberActiveStatusMutateMock).toHaveBeenNthCalledWith(
        2,
        { userId: "user-1", active: false },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "상태 변경 실패: update failed",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));
    expect(screen.getByTestId("status-dialog")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
