import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionViewPage from "@/app/actions/view/page";
import {
  useAction,
  useDeleteActionImage,
  useUpdateActionStatus,
  useUploadActionImage,
} from "@/hooks/use-api";
import { compressImage } from "@/lib/image-compress";
import { setMockSearchParams, getMockRouter } from "@/__tests__/mocks";

vi.mock("@/hooks/use-api", () => ({
  useAction: vi.fn(),
  useUpdateActionStatus: vi.fn(),
  useUploadActionImage: vi.fn(),
  useDeleteActionImage: vi.fn(),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (file: File) => file),
}));

describe("app/actions/view/page", () => {
  const createAction = (overrides: Record<string, unknown> = {}) => ({
    id: "a1",
    actionStatus: "ASSIGNED",
    priority: "HIGH",
    description: "조치 필요",
    dueDate: null,
    assignee: null,
    images: [],
    post: null,
    completionNote: "",
    ...overrides,
  });

  beforeEach(() => {
    setMockSearchParams({ id: "a1" });
    vi.clearAllMocks();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useUploadActionImage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useDeleteActionImage).mockReturnValue({
      mutate: vi.fn(),
    } as never);
  });

  it("renders not found state", () => {
    vi.mocked(useAction).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("x"),
    } as never);
    render(<ActionViewPage />);
    fireEvent.click(screen.getByRole("button", { name: "actions.view.back" }));
    expect(getMockRouter().back).toHaveBeenCalled();
  });

  it("updates status from assigned to in-progress", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction(),
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.startProgress" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
  });

  it("shows not found state when action data is missing without error", () => {
    vi.mocked(useAction).mockReturnValue({
      data: { data: null },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);

    expect(screen.getByText("actions.view.notFound")).toBeInTheDocument();
  });

  it("renders completed status with completion note branch", () => {
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction({
          actionStatus: "COMPLETED",
          completionNote: "점검 완료",
          dueDate: "2099-10-10",
          assignee: { nameMasked: "홍*동" },
          post: { title: "관련 보고" },
        }),
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);

    expect(
      screen.getByText("actions.view.completionMessage"),
    ).toBeInTheDocument();
    expect(screen.getByText("점검 완료")).toBeInTheDocument();
    expect(screen.getByText(/actions.view.relatedReport/)).toBeInTheDocument();
    expect(screen.getByText(/홍\*동/)).toBeInTheDocument();
  });

  it("renders fallback labels for unknown status and priority", () => {
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction({
          actionStatus: "UNKNOWN_STATUS",
          priority: "UNKNOWN_PRIORITY",
          images: undefined,
        }),
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);

    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN_PRIORITY")).toBeInTheDocument();
  });

  it("submits completion note from in-progress state", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction({ actionStatus: "IN_PROGRESS" }),
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);

    fireEvent.change(screen.getByLabelText("actions.view.requiredCompletion"), {
      target: { value: "완료 처리" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.reportCompletion" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        actionId: "a1",
        data: {
          actionStatus: "COMPLETED",
          completionNote: "완료 처리",
        },
      });
    });
  });

  it("handles image upload error path", async () => {
    vi.mocked(compressImage).mockRejectedValueOnce(
      new Error("compress failed"),
    );
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction(),
      },
      isLoading: false,
      error: null,
    } as never);

    const file = new File(["x"], "test.png", { type: "image/png" });
    render(<ActionViewPage />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(compressImage).toHaveBeenCalled();
    });
  });

  it("renders overdue state and resumes progress", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: createAction({ actionStatus: "OVERDUE" }),
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionViewPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.resumeProgress" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        actionId: "a1",
        data: {
          actionStatus: "IN_PROGRESS",
          completionNote: undefined,
        },
      });
    });
  });
});
