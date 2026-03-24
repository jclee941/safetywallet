import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionImageGallery } from "@/app/actions/view/action-image-gallery";

vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
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
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("ActionImageGallery", () => {
  it("renders empty state", () => {
    render(
      <ActionImageGallery
        title="before"
        images={[]}
        onUploadClick={vi.fn()}
        isUploading={false}
        onDeleteImage={vi.fn()}
        emptyMessage="no-images"
        imageAlt="before-alt"
      />,
    );

    expect(screen.getByText("no-images")).toBeInTheDocument();
  });

  it("calls upload handler and supports disabled upload", () => {
    const onUploadClick = vi.fn();

    const { rerender } = render(
      <ActionImageGallery
        title="before"
        images={[]}
        onUploadClick={onUploadClick}
        isUploading={false}
        onDeleteImage={vi.fn()}
        emptyMessage="no-images"
        imageAlt="before-alt"
      />,
    );

    const uploadButton = screen.getByRole("button", {
      name: "actions.view.upload",
    });
    fireEvent.click(uploadButton);
    expect(onUploadClick).toHaveBeenCalledTimes(1);

    rerender(
      <ActionImageGallery
        title="before"
        images={[]}
        onUploadClick={onUploadClick}
        isUploading
        onDeleteImage={vi.fn()}
        emptyMessage="no-images"
        imageAlt="before-alt"
      />,
    );

    expect(
      screen.getByRole("button", { name: "actions.view.upload" }),
    ).toBeDisabled();
  });

  it("renders images and deletes selected item", () => {
    const onDeleteImage = vi.fn();
    render(
      <ActionImageGallery
        title="before"
        images={[
          {
            id: "img-1",
            fileUrl: "https://example.com/1.jpg",
            thumbnailUrl: "https://example.com/1-thumb.jpg",
            imageType: "BEFORE",
            createdAt: "2026-03-23T00:00:00.000Z",
          },
        ]}
        onUploadClick={vi.fn()}
        isUploading={false}
        onDeleteImage={onDeleteImage}
        emptyMessage="no-images"
        imageAlt="before-alt"
      />,
    );

    expect(screen.getByRole("img", { name: "before-alt" })).toHaveAttribute(
      "src",
      "https://example.com/1.jpg",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "actions.view.delete" }),
    );
    expect(onDeleteImage).toHaveBeenCalledWith("img-1");
  });
});
