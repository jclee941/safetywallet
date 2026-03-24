import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionDetailContent } from "@/app/actions/view/action-detail-content";
import {
  useAction,
  useDeleteActionImage,
  useUpdateActionStatus,
  useUploadActionImage,
} from "@/hooks/use-api";
import { compressImage } from "@/lib/image-compress";
import { getMockRouter, setMockSearchParams } from "@/__tests__/mocks";

const toastMock = vi.fn();
const renderedButtonProps: Array<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }
> = [];

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
  BottomNav: () => <div>bottom</div>,
}));

vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (file: File) => file),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(" "),
}));

vi.mock("@/app/actions/view/action-image-gallery", () => ({
  ActionImageGallery: ({
    title,
    images,
    onUploadClick,
    onDeleteImage,
  }: {
    title: string;
    images: Array<{ id: string }>;
    onUploadClick: () => void;
    onDeleteImage: (id: string) => void;
  }) => (
    <div>
      <div>{title}</div>
      <span>{images.length}</span>
      <button type="button" onClick={onUploadClick}>
        upload-{title}
      </button>
      <button type="button" onClick={() => onDeleteImage("img-1")}>
        delete-{title}
      </button>
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    (() => {
      renderedButtonProps.push({ ...props, children });
      return (
        <button type="button" {...props}>
          {children}
        </button>
      );
    })(),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
  useToast: () => ({ toast: toastMock }),
}));

const baseAction = {
  id: "a1",
  actionStatus: "ASSIGNED",
  priority: "HIGH",
  description: "조치 필요",
  dueDate: "2026-03-25T00:00:00.000Z",
  assignee: { nameMasked: "홍*동" },
  completionNote: null,
  post: { title: "관련 제보" },
  images: [
    {
      id: "img-1",
      imageType: "BEFORE",
      fileUrl: "https://example.com/before.jpg",
      thumbnailUrl: "https://example.com/before-thumb.jpg",
      createdAt: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "img-2",
      imageType: "AFTER",
      fileUrl: "https://example.com/after.jpg",
      thumbnailUrl: "https://example.com/after-thumb.jpg",
      createdAt: "2026-03-23T00:00:00.000Z",
    },
  ],
};

describe("ActionDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderedButtonProps.length = 0;
    setMockSearchParams({ id: "a1" });

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

  it("renders loading shell", () => {
    vi.mocked(useAction).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("bottom")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });

  it("renders not found state and goes back", () => {
    vi.mocked(useAction).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("not-found"),
    } as never);

    render(<ActionDetailContent />);
    fireEvent.click(screen.getByRole("button", { name: "actions.view.back" }));
    expect(getMockRouter().back).toHaveBeenCalledTimes(1);
  });

  it("updates ASSIGNED action to IN_PROGRESS", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: baseAction },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);
    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.startProgress" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        actionId: "a1",
        data: { actionStatus: "IN_PROGRESS", completionNote: undefined },
      });
    });
  });

  it("completes IN_PROGRESS action with completion note", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: { ...baseAction, actionStatus: "IN_PROGRESS" } },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    fireEvent.change(
      screen.getByPlaceholderText("actions.view.completionPlaceholder"),
      { target: { value: "완료 보고" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.reportCompletion" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        actionId: "a1",
        data: { actionStatus: "COMPLETED", completionNote: "완료 보고" },
      });
    });
  });

  it("keeps completion action disabled without completion note", () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: { ...baseAction, actionStatus: "IN_PROGRESS" } },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    const reportCompletionButton = screen.getByRole("button", {
      name: "actions.view.reportCompletion",
    });

    expect(reportCompletionButton).toBeDisabled();
    fireEvent.click(reportCompletionButton);

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("shows destructive toast when completion action is triggered with empty note", () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: { ...baseAction, actionStatus: "IN_PROGRESS" } },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    const reportCompletionButton = renderedButtonProps.find(
      (props) => props.children === "actions.view.reportCompletion",
    );
    expect(reportCompletionButton?.onClick).toBeDefined();

    const invokeClick = reportCompletionButton?.onClick as
      | (() => void)
      | undefined;
    invokeClick?.();

    expect(mutate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "actions.view.inputRequired",
        description: "actions.view.pleaseEnterCompletion",
        variant: "destructive",
      }),
    );
  });

  it("handles back-list and overdue resume actions", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateActionStatus).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: {
        data: {
          ...baseAction,
          actionStatus: "OVERDUE",
          images: [],
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.backList" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.resumeProgress" }),
    );

    expect(getMockRouter().back).toHaveBeenCalled();
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        actionId: "a1",
        data: { actionStatus: "IN_PROGRESS", completionNote: undefined },
      });
    });
  });

  it("uploads image after compression with selected upload type", async () => {
    const uploadMutate = vi.fn();
    vi.mocked(useUploadActionImage).mockReturnValue({
      mutate: uploadMutate,
      isPending: false,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: baseAction },
      isLoading: false,
      error: null,
    } as never);

    const { container } = render(<ActionDetailContent />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "upload-actions.view.afterPhotos",
      }),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["image-data"], "a.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(compressImage).toHaveBeenCalledWith(file);
      expect(uploadMutate).toHaveBeenCalledTimes(1);
    });

    const uploadPayload = uploadMutate.mock.calls[0][0] as {
      actionId: string;
      formData: FormData;
    };

    expect(uploadPayload.actionId).toBe("a1");
    expect(uploadPayload.formData.get("imageType")).toBe("AFTER");
    expect(uploadPayload.formData.get("file")).toBeInstanceOf(File);
    expect(fileInput.value).toBe("");
  });

  it("shows toast when image compression fails", async () => {
    vi.mocked(compressImage).mockRejectedValueOnce(
      new Error("compression-fail"),
    );
    vi.mocked(useAction).mockReturnValue({
      data: { data: baseAction },
      isLoading: false,
      error: null,
    } as never);

    const { container } = render(<ActionDetailContent />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "upload-actions.view.beforePhotos",
      }),
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["image-data"], "b.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "common.error",
          description: "actions.view.uploadError",
          variant: "destructive",
        }),
      );
    });
  });

  it("deletes action image from gallery callback", async () => {
    const deleteMutate = vi.fn();
    vi.mocked(useDeleteActionImage).mockReturnValue({
      mutate: deleteMutate,
    } as never);

    vi.mocked(useAction).mockReturnValue({
      data: { data: baseAction },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "delete-actions.view.beforePhotos",
      }),
    );

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith({
        actionId: "a1",
        imageId: "img-1",
      });
    });
  });

  it("does not render completion note content box when completion note is empty", () => {
    vi.mocked(useAction).mockReturnValue({
      data: {
        data: {
          ...baseAction,
          actionStatus: "COMPLETED",
          completionNote: "",
          images: [],
        },
      },
      isLoading: false,
      error: null,
    } as never);

    render(<ActionDetailContent />);

    expect(
      screen.getByText("actions.view.completionMessage"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("actions.view.completionContent"),
    ).not.toBeInTheDocument();
  });
});
