import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewPostPage from "@/app/posts/new/page";
import { useAuth } from "@/hooks/use-auth";
import { useCreatePost } from "@/hooks/use-api";
import { getMockRouter } from "@/__tests__/mocks";
import { compressImages } from "@/lib/image-compress";
import { apiFetch } from "@/lib/api";
import { Category, RiskLevel } from "@safetywallet/types";

const toastMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-api", () => ({ useCreatePost: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/unsafe-warning-modal", () => ({
  UnsafeWarningModal: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={onConfirm}>
          warning-confirm
        </button>
        <button type="button" onClick={onCancel}>
          warning-cancel
        </button>
      </div>
    ) : null,
}));
vi.mock("@/lib/image-compress", () => ({
  compressImages: vi.fn(async (files: File[]) => files),
}));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@safetywallet/ui", async () => {
  const actual = await vi.importActual("@safetywallet/ui");
  return {
    ...actual,
    useToast: () => ({ toast: toastMock }),
  };
});

describe("app/posts/new/page", () => {
  const draftKey = "safetywallet_post_draft_site-1";
  const legacyDraftKey = "safework2_post_draft_site-1";

  const createSizedFile = (name: string, type: string, size: number) => {
    const file = new File(["content"], name, { type });
    Object.defineProperty(file, "size", { value: size, configurable: true });
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: "site-1",
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });
    vi.mocked(useCreatePost).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { post: { id: "p1" } } }),
    } as never);
    vi.mocked(compressImages).mockResolvedValue([]);
    vi.mocked(apiFetch).mockResolvedValue({} as never);
  });

  it("renders category options and hides location for inconvenience", () => {
    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.inconvenience/ }),
    );
    expect(
      screen.queryByPlaceholderText("posts.new.zone"),
    ).not.toBeInTheDocument();
  });

  it("opens unsafe warning modal before submit", () => {
    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.unsafeBehavior/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));

    expect(
      screen.getByRole("button", { name: "warning-confirm" }),
    ).toBeInTheDocument();
  });

  it("submits post and redirects to list", async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ data: { post: { id: "p1" } } });
    vi.mocked(useCreatePost).mockReturnValue({ mutateAsync } as never);

    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.hazard/ }),
    );
    fireEvent.change(screen.getByPlaceholderText("posts.description"), {
      target: { value: "위험 요소 발견" },
    });
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
      expect(getMockRouter().replace).toHaveBeenCalledWith("/posts");
    });
  });

  it("handles risk/location fields, file preview removal, and warning cancel", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video-preview");

    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.hazard/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "actions.priority.medium" }),
    );

    fireEvent.change(screen.getByPlaceholderText("posts.location"), {
      target: { value: "4F" },
    });
    fireEvent.change(screen.getByPlaceholderText("posts.new.zone"), {
      target: { value: "B-12" },
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const imageFile = new File(["image"], "hazard.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "clip.mp4", {
      type: "video/mp4",
    });

    fireEvent.change(fileInput, {
      target: { files: [imageFile, videoFile] },
    });

    expect(await screen.findByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("hazard.png")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "common.delete" })[0],
    );
    await waitFor(() => {
      expect(screen.queryByText("hazard.png")).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.unsafeBehavior/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));
    fireEvent.click(screen.getByRole("button", { name: "warning-cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "warning-confirm" }),
      ).not.toBeInTheDocument();
    });
  });

  it("migrates and restores legacy draft data", () => {
    localStorage.setItem(
      legacyDraftKey,
      JSON.stringify({
        category: Category.HAZARD,
        hazardSubcategory: "FALL",
        riskLevel: RiskLevel.HIGH,
        content: "legacy draft",
        locationFloor: "2F",
        locationZone: "A-01",
        isAnonymous: true,
        savedAt: Date.now(),
      }),
    );

    render(<NewPostPage />);

    expect(localStorage.getItem(legacyDraftKey)).toBeNull();
    expect(localStorage.getItem(draftKey)).not.toBeNull();
    expect(screen.getByDisplayValue("legacy draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2F")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A-01")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("clears expired draft on load", () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        category: Category.HAZARD,
        content: "old draft",
        savedAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    render(<NewPostPage />);

    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.queryByDisplayValue("old draft")).not.toBeInTheDocument();
  });

  it("ignores corrupted draft data", () => {
    localStorage.setItem(draftKey, "not-json");

    render(<NewPostPage />);

    expect(screen.getByRole("button", { name: "posts.submit" })).toBeDisabled();
    expect(screen.getByPlaceholderText("posts.description")).toHaveValue("");
  });

  it("shows upload error toast when file limit is exceeded", () => {
    render(<NewPostPage />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const tooManyFiles = Array.from(
      { length: 6 },
      (_, idx) => new File(["f"], `f-${idx}.png`, { type: "image/png" }),
    );

    fireEvent.change(fileInput, {
      target: { files: tooManyFiles },
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "posts.error.uploadFailed",
      variant: "destructive",
    });
  });

  it("skips oversized files and keeps valid files", async () => {
    render(<NewPostPage />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const oversizedImage = createSizedFile(
      "too-large.png",
      "image/png",
      11 * 1024 * 1024,
    );
    const validVideo = createSizedFile("ok.mp4", "video/mp4", 5 * 1024 * 1024);

    fireEvent.change(fileInput, {
      target: { files: [oversizedImage, validVideo] },
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "common.error",
      variant: "destructive",
    });
    expect(await screen.findByText("ok.mp4")).toBeInTheDocument();
    expect(screen.queryByText("too-large.png")).not.toBeInTheDocument();
  });

  it("shows partial upload failure toast when some media uploads fail", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:upload-preview");
    vi.mocked(compressImages).mockImplementation(async (files) => files);
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("upload failed"));

    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.hazard/ }),
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const imageFile = new File(["img"], "photo.png", { type: "image/png" });
    const videoFile = new File(["vid"], "clip.mp4", { type: "video/mp4" });

    fireEvent.change(fileInput, {
      target: { files: [imageFile, videoFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "posts.error.uploadFailed",
        description: "1 common.ok, 1 common.error",
        variant: "destructive",
      }),
    );
  });

  it("shows destructive toast when post submission fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("create failed"));
    vi.mocked(useCreatePost).mockReturnValue({ mutateAsync } as never);

    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.hazard/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "posts.error.uploadFailed",
      description: "common.tryAgain",
      variant: "destructive",
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "posts.submit" }),
      ).toBeEnabled();
    });
  });

  it("does not submit when site id is missing", async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: null,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });
    vi.mocked(useCreatePost).mockReturnValue({ mutateAsync } as never);

    render(<NewPostPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /posts.category.hazard/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "posts.submit" }));

    await waitFor(() => {
      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });

  it("triggers router.back when cancel is clicked", () => {
    render(<NewPostPage />);

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(getMockRouter().back).toHaveBeenCalledTimes(1);
  });

  it("saves draft after edits and supports subcategory/file-trigger/anonymous interactions", async () => {
    const fileClickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      render(<NewPostPage />);

      fireEvent.click(
        screen.getByRole("button", { name: /posts.category.hazard/ }),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: /posts.new.hazardSubcategory_FIRE/,
        }),
      );
      fireEvent.change(screen.getByPlaceholderText("posts.description"), {
        target: { value: "draft content" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(
        screen.getByRole("button", { name: "posts.new.addPhotoVideo" }),
      );

      await waitFor(
        () => {
          const stored = localStorage.getItem(draftKey);
          expect(stored).not.toBeNull();
          expect(stored).toContain("draft content");
        },
        { timeout: 3000 },
      );
      expect(fileClickSpy).toHaveBeenCalled();
    } finally {
      fileClickSpy.mockRestore();
    }
  });
});
