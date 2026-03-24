import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemberDetailPage from "../member-detail";
import { useMember, useSetMemberActiveStatus } from "@/hooks/use-api";

const { backMock, toastMock, mutateMock } = vi.hoisted(() => ({
  backMock: vi.fn(),
  toastMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "member-1" }),
  useRouter: () => ({ back: backMock }),
}));

vi.mock("@/hooks/use-api", () => ({
  useMember: vi.fn(),
  useSetMemberActiveStatus: vi.fn(),
}));

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props} />
    ),
    Badge: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    AlertDialog: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
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
    AlertDialogCancel: (
      props: React.ButtonHTMLAttributes<HTMLButtonElement>,
    ) => <button type="button" {...props} />,
    AlertDialogAction: (
      props: React.ButtonHTMLAttributes<HTMLButtonElement>,
    ) => <button type="button" {...props} />,
    toast: toastMock,
  };
});

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  ShieldX: () => null,
}));

const mockUseMember = vi.mocked(useMember);
const mockUseSetMemberActiveStatus = vi.mocked(useSetMemberActiveStatus);

const toMemberResult = (value: unknown): ReturnType<typeof useMember> =>
  value as never;
const toSetMemberActiveStatusResult = (
  value: unknown,
): ReturnType<typeof useSetMemberActiveStatus> => value as never;

const baseMember = {
  id: "member-1",
  status: "ACTIVE",
  role: "MANAGER",
  joinedAt: "2026-03-24T00:00:00.000Z",
  user: { id: "user-1", name: "홍길동" },
};

describe("MemberDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSetMemberActiveStatus.mockReturnValue(
      toSetMemberActiveStatusResult({ mutate: mutateMock, isPending: false }),
    );
  });

  it("renders loading skeleton", () => {
    mockUseMember.mockReturnValue(
      toMemberResult({ data: null, isLoading: true, refetch: vi.fn() }),
    );

    const { rerender } = render(<MemberDetailPage />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
  });

  it("renders not-found state and back action", () => {
    mockUseMember.mockReturnValue(
      toMemberResult({ data: null, isLoading: false, refetch: vi.fn() }),
    );

    const { rerender } = render(<MemberDetailPage />);
    expect(screen.getByText("회원을 찾을 수 없습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(backMock).toHaveBeenCalled();
  });

  it("renders member details and active/deactive labels", () => {
    mockUseMember.mockReturnValue(
      toMemberResult({ data: baseMember, isLoading: false, refetch: vi.fn() }),
    );

    const { rerender } = render(<MemberDetailPage />);

    expect(screen.getByText("회원 상세")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비활성화" }),
    ).toBeInTheDocument();

    mockUseMember.mockReturnValue(
      toMemberResult({
        data: { ...baseMember, status: "INACTIVE" },
        isLoading: false,
        refetch: vi.fn(),
      }),
    );
    rerender(<MemberDetailPage />);

    expect(screen.getByRole("button", { name: "활성화" })).toBeInTheDocument();
  });

  it("handles header back and status toggle controls", () => {
    mockUseMember.mockReturnValue(
      toMemberResult({ data: baseMember, isLoading: false, refetch: vi.fn() }),
    );

    render(<MemberDetailPage />);

    const headerBackButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.trim() === "");
    expect(headerBackButton).toBeDefined();
    if (headerBackButton) {
      fireEvent.click(headerBackButton);
    }
    expect(backMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    expect(screen.getByRole("button", { name: "확인" })).toBeInTheDocument();
  });

  it("keeps status mutation untouched when member data is missing", () => {
    mockUseMember.mockReturnValue(
      toMemberResult({ data: null, isLoading: false, refetch: vi.fn() }),
    );

    render(<MemberDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("changes status successfully and refetches", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mutateMock.mockImplementation(
      (
        _payload: unknown,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void },
      ) => {
        options?.onSuccess?.();
      },
    );

    mockUseMember.mockReturnValue(
      toMemberResult({ data: baseMember, isLoading: false, refetch }),
    );

    const { rerender } = render(<MemberDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          userId: "user-1",
          active: false,
        },
        expect.any(Object),
      );
      expect(toastMock).toHaveBeenCalledWith({
        description: "홍길동 회원 상태가 비활성으로 변경되었습니다.",
      });
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("shows error toast when status change fails and disables action when pending", () => {
    mutateMock.mockImplementation(
      (
        _payload: unknown,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void },
      ) => {
        options?.onError?.(new Error("실패"));
      },
    );

    mockUseMember.mockReturnValue(
      toMemberResult({ data: baseMember, isLoading: false, refetch: vi.fn() }),
    );
    mockUseSetMemberActiveStatus.mockReturnValue(
      toSetMemberActiveStatusResult({ mutate: mutateMock, isPending: false }),
    );

    const { rerender } = render(<MemberDetailPage />);

    const confirmButton = screen.getByRole("button", { name: "확인" });
    fireEvent.click(confirmButton);

    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      description: "상태 변경 실패: 실패",
    });

    mockUseSetMemberActiveStatus.mockReturnValue(
      toSetMemberActiveStatusResult({ mutate: mutateMock, isPending: true }),
    );
    rerender(<MemberDetailPage />);
    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
  });
});
