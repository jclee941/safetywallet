import type { FormEvent, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PointPoliciesPage from "../page";
import {
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useUpdatePolicy,
} from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";
import { extractCreateData, extractUpdateData } from "../policy-helpers";

const toastMock = vi.fn();
const createMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const deleteMutateAsyncMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/points/policies",
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
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
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/hooks/use-api", () => ({
  usePolicies: vi.fn(),
  useCreatePolicy: vi.fn(),
  useUpdatePolicy: vi.fn(),
  useDeletePolicy: vi.fn(),
}));

vi.mock("../policy-helpers", () => ({
  extractCreateData: vi.fn(),
  extractUpdateData: vi.fn(),
}));

vi.mock("../components/policies-data-table", () => ({
  PoliciesDataTable: ({
    onEdit,
    onDelete,
  }: {
    onEdit: (policy: { id: string; reasonCode: string; name: string }) => void;
    onDelete: (id: string) => void;
    policies: unknown[];
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onEdit({
            id: "p1",
            reasonCode: "SAFE",
            name: "정책",
          })
        }
      >
        edit-policy
      </button>
      <button type="button" onClick={() => onDelete("p1")}>
        delete-policy
      </button>
    </div>
  ),
}));

vi.mock("../components/policy-form-dialog", () => ({
  PolicyFormDialog: ({
    mode,
    open,
    onSubmit,
    onOpenChange,
  }: {
    mode: "create" | "edit";
    open: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open || mode === "edit" ? (
      <form onSubmit={onSubmit}>
        <p>{mode}-dialog-open</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          close-{mode}
        </button>
        <button type="submit">submit-{mode}</button>
      </form>
    ) : null,
}));

vi.mock("../components/delete-policy-dialog", () => ({
  DeletePolicyDialog: ({
    open,
    onOpenChange,
    onConfirm,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onOpenChange(false)}>
          close-delete
        </button>
        <button type="button" onClick={onConfirm}>
          confirm-delete
        </button>
      </div>
    ) : null,
}));

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUsePolicies = vi.mocked(usePolicies);
const mockUseCreatePolicy = vi.mocked(useCreatePolicy);
const mockUseUpdatePolicy = vi.mocked(useUpdatePolicy);
const mockUseDeletePolicy = vi.mocked(useDeletePolicy);
const mockExtractCreateData = vi.mocked(extractCreateData);
const mockExtractUpdateData = vi.mocked(extractUpdateData);

describe("PointPoliciesPage", () => {
  beforeEach(() => {
    toastMock.mockReset();
    createMutateAsyncMock.mockReset();
    updateMutateAsyncMock.mockReset();
    deleteMutateAsyncMock.mockReset();

    mockUseAuthStore.mockReturnValue({ currentSiteId: "site-1" } as never);
    mockUsePolicies.mockReturnValue({ data: [], isLoading: false } as never);
    mockUseCreatePolicy.mockReturnValue({
      mutateAsync: createMutateAsyncMock,
    } as never);
    mockUseUpdatePolicy.mockReturnValue({
      mutateAsync: updateMutateAsyncMock,
    } as never);
    mockUseDeletePolicy.mockReturnValue({
      mutateAsync: deleteMutateAsyncMock,
    } as never);
    mockExtractCreateData.mockReturnValue({
      siteId: "site-1",
      reasonCode: "SAFE",
      name: "정책",
      description: "",
      defaultAmount: 10,
    } as never);
    mockExtractUpdateData.mockReturnValue({
      name: "정책",
      description: "",
      defaultAmount: 10,
      isActive: true,
    } as never);
  });

  it("renders loading state", () => {
    mockUsePolicies.mockReturnValue({ data: [], isLoading: true } as never);
    render(<PointPoliciesPage />);

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("creates policy and closes create dialog on success", async () => {
    createMutateAsyncMock.mockResolvedValue(undefined);

    render(<PointPoliciesPage />);

    fireEvent.click(screen.getByRole("button", { name: "정책 추가" }));
    expect(screen.getByText("create-dialog-open")).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("button", { name: "submit-create" }));

    await waitFor(() => {
      expect(mockExtractCreateData).toHaveBeenCalled();
      expect(createMutateAsyncMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith({
        title: "정책이 생성되었습니다.",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("create-dialog-open")).not.toBeInTheDocument();
    });
  });

  it("shows validation toast when site is missing", async () => {
    mockUseAuthStore.mockReturnValue({ currentSiteId: null } as never);

    render(<PointPoliciesPage />);
    fireEvent.click(screen.getByRole("button", { name: "정책 추가" }));
    fireEvent.submit(screen.getByRole("button", { name: "submit-create" }));

    await waitFor(() => {
      expect(createMutateAsyncMock).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "현장 미선택",
          variant: "destructive",
        }),
      );
    });
  });

  it("shows create failure toast for Error and unknown value", async () => {
    createMutateAsyncMock.mockRejectedValueOnce(new Error("생성 실패"));

    render(<PointPoliciesPage />);
    fireEvent.click(screen.getByRole("button", { name: "정책 추가" }));
    fireEvent.submit(screen.getByRole("button", { name: "submit-create" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "생성 실패",
          description: "생성 실패",
        }),
      );
    });

    createMutateAsyncMock.mockRejectedValueOnce("unknown");
    fireEvent.submit(screen.getByRole("button", { name: "submit-create" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "생성 실패",
          description: "정책 생성 중 오류가 발생했습니다.",
        }),
      );
    });
  });

  it("updates policy, handles early return, and handles update failure", async () => {
    updateMutateAsyncMock.mockResolvedValue(undefined);

    render(<PointPoliciesPage />);

    fireEvent.click(screen.getByRole("button", { name: "edit-policy" }));
    expect(screen.getByText("edit-dialog-open")).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("button", { name: "submit-edit" }));
    await waitFor(() => {
      expect(mockExtractUpdateData).toHaveBeenCalled();
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        id: "p1",
        data: expect.objectContaining({ name: "정책" }),
      });
      expect(toastMock).toHaveBeenCalledWith({
        title: "정책이 수정되었습니다.",
      });
    });

    fireEvent.submit(screen.getByRole("button", { name: "submit-edit" }));
    expect(updateMutateAsyncMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "edit-policy" }));
    updateMutateAsyncMock.mockRejectedValueOnce(new Error("update failed"));
    fireEvent.submit(screen.getByRole("button", { name: "submit-edit" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "수정 실패",
          description: "정책 수정 중 오류가 발생했습니다.",
        }),
      );
    });
  });

  it("deletes policy and handles delete failure", async () => {
    deleteMutateAsyncMock.mockResolvedValue(undefined);

    render(<PointPoliciesPage />);
    fireEvent.click(screen.getByRole("button", { name: "delete-policy" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-delete" }));

    await waitFor(() => {
      expect(deleteMutateAsyncMock).toHaveBeenCalledWith("p1");
      expect(toastMock).toHaveBeenCalledWith({
        title: "정책이 삭제되었습니다.",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "delete-policy" }));
    deleteMutateAsyncMock.mockRejectedValueOnce(new Error("failed"));
    fireEvent.click(screen.getByRole("button", { name: "confirm-delete" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "삭제 실패",
          description: "정책 삭제 중 오류가 발생했습니다.",
        }),
      );
    });
  });

  it("resets edit/delete state through onOpenChange(false)", async () => {
    render(<PointPoliciesPage />);

    fireEvent.click(screen.getByRole("button", { name: "edit-policy" }));
    expect(screen.getByText("edit-dialog-open")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "close-edit" }));
    fireEvent.submit(screen.getByRole("button", { name: "submit-edit" }));
    expect(updateMutateAsyncMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "delete-policy" }));
    expect(
      screen.getByRole("button", { name: "confirm-delete" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "close-delete" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "confirm-delete" }),
      ).not.toBeInTheDocument();
    });
  });
});
