import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetClose,
} from "../components/sheet";

describe("Sheet", () => {
  it("SheetOverlay renders with correct classes", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay data-testid="overlay" />
        </SheetPortal>
      </Sheet>,
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay).toHaveClass("fixed");
    expect(overlay).toHaveClass("inset-0");
    expect(overlay).toHaveClass("z-50");
    expect(overlay).toHaveClass("bg-black/80");
    expect(overlay).toHaveClass("data-[state=open]:animate-in");
    expect(overlay).toHaveClass("data-[state=closed]:animate-out");
    expect(overlay).toHaveClass("data-[state=closed]:fade-out-0");
    expect(overlay).toHaveClass("data-[state=open]:fade-in-0");
    expect(overlay).toHaveClass("data-[state=closed]:pointer-events-none");
    expect(overlay).toHaveClass("data-[state=open]:pointer-events-auto");
  });

  it("SheetContent renders with top side variant", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="top">
            <p>Top Sheet Content</p>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const content = screen.getByTestId("content");
    expect(content).toHaveClass("fixed");
    expect(content).toHaveClass("z-50");
    expect(content).toHaveClass("gap-4");
    expect(content).toHaveClass("bg-background");
    expect(content).toHaveClass("p-6");
    expect(content).toHaveClass("shadow-lg");
    expect(content).toHaveClass("inset-x-0");
    expect(content).toHaveClass("top-0");
    expect(content).toHaveClass("border-b");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-top");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-top");
  });

  it("SheetContent renders with bottom side variant", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="bottom">
            <p>Bottom Sheet Content</p>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const content = screen.getByTestId("content");
    expect(content).toHaveClass("inset-x-0");
    expect(content).toHaveClass("bottom-0");
    expect(content).toHaveClass("border-t");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-bottom");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-bottom");
  });

  it("SheetContent renders with left side variant", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="left">
            <p>Left Sheet Content</p>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const content = screen.getByTestId("content");
    expect(content).toHaveClass("inset-y-0");
    expect(content).toHaveClass("left-0");
    expect(content).toHaveClass("h-full");
    expect(content).toHaveClass("w-3/4");
    expect(content).toHaveClass("border-r");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-left");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-left");
    expect(content).toHaveClass("sm:max-w-sm");
  });

  it("SheetContent renders with right side variant (default)", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="right">
            <p>Right Sheet Content</p>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const content = screen.getByTestId("content");
    expect(content).toHaveClass("inset-y-0");
    expect(content).toHaveClass("right-0");
    expect(content).toHaveClass("h-full");
    expect(content).toHaveClass("w-3/4");
    expect(content).toHaveClass("border-l");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-right");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-right");
    expect(content).toHaveClass("sm:max-w-sm");
  });

  it("SheetHeader renders with correct classes", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent side="right">
            <SheetHeader data-testid="header">
              <p>Header Content</p>
            </SheetHeader>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("space-y-2");
    expect(header).toHaveClass("text-center");
    expect(header).toHaveClass("sm:text-left");
  });

  it("SheetFooter renders with correct classes", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent side="right">
            <SheetFooter data-testid="footer">
              <p>Footer Content</p>
            </SheetFooter>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const footer = screen.getByTestId("footer");
    expect(footer).toHaveClass("flex");
    expect(footer).toHaveClass("flex-col-reverse");
    expect(footer).toHaveClass("sm:flex-row");
    expect(footer).toHaveClass("sm:justify-end");
    expect(footer).toHaveClass("sm:space-x-2");
  });

  it("SheetTitle renders with correct classes", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent side="right">
            <SheetTitle data-testid="title">Test Title</SheetTitle>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const title = screen.getByTestId("title");
    expect(title).toHaveClass("text-lg");
    expect(title).toHaveClass("font-semibold");
    expect(title).toHaveClass("text-foreground");
  });

  it("SheetDescription renders with correct classes", () => {
    render(
      <Sheet open>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent side="right">
            <SheetDescription data-testid="description">
              Test Description
            </SheetDescription>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    const description = screen.getByTestId("description");
    expect(description).toHaveClass("text-sm");
    expect(description).toHaveClass("text-muted-foreground");
  });

  it("Sheet opens and closes via trigger", async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button" data-testid="trigger">
            Open Sheet
          </button>
        </SheetTrigger>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="right">
            <SheetTitle>Sheet Title</SheetTitle>
            <p>Sheet Body</p>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    // Content should not be visible initially
    expect(screen.queryByTestId("content")).toBeNull();

    // Click the trigger to open
    await user.click(screen.getByTestId("trigger"));

    // Content should now be visible
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
    expect(screen.getByText("Sheet Body")).toBeInTheDocument();
  });

  it("SheetClose renders and is clickable", async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button" data-testid="trigger">
            Open Sheet
          </button>
        </SheetTrigger>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent data-testid="content" side="right">
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetClose asChild>
              <button type="button" data-testid="close">
                Close
              </button>
            </SheetClose>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    // Open the sheet
    await user.click(screen.getByTestId("trigger"));
    expect(screen.getByTestId("content")).toBeInTheDocument();

    // Click the close button
    await user.click(screen.getByTestId("close"));

    // Content should be closed
    expect(screen.queryByTestId("content")).toBeNull();
  });
});
