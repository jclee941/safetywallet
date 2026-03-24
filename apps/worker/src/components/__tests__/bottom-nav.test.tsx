import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/bottom-nav";
import { setMockPathname } from "@/__tests__/mocks";

vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => `translated:${key}`,
}));

describe("BottomNav", () => {
  it("renders translated nav labels and center action button", () => {
    setMockPathname("/home");
    render(<BottomNav />);

    expect(screen.getByText("translated:nav.home")).toBeInTheDocument();
    expect(screen.getByText("translated:nav.education")).toBeInTheDocument();
    expect(screen.getByText("translated:nav.wallet")).toBeInTheDocument();
    expect(screen.getByText("translated:nav.profile")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    const centerLink = links.find(
      (link) => link.getAttribute("href") === "/posts/new",
    );
    expect(centerLink).toBeDefined();
    expect(centerLink).toHaveTextContent("Create");
  });

  it("applies active class for current path", () => {
    setMockPathname("/education/quiz");
    render(<BottomNav />);

    const educationText = screen.getByText("translated:nav.education");
    const educationLink = educationText.closest("a");

    expect(educationLink).toHaveClass("text-blue-400");
    expect(educationLink).not.toHaveClass("text-muted-foreground");
  });

  it("shows education alert dot and center aria label", () => {
    setMockPathname("/profile");
    const { container } = render(<BottomNav />);

    expect(
      screen.getByRole("link", {
        name: "translated:nav.createReportAria",
      }),
    ).toBeInTheDocument();

    expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
  });

  it("renders empty label text when a nav item label is falsy", () => {
    setMockPathname("/posts/new");

    const originalMap = Array.prototype.map;
    const mapSpy = vi.spyOn(Array.prototype, "map");

    mapSpy.mockImplementation(function <T, U>(
      this: T[],
      callbackfn: (value: T, index: number, array: T[]) => U,
      thisArg?: unknown,
    ): U[] {
      const isBottomNavItemsArray =
        this.length === 5 &&
        this.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "href" in (item as Record<string, unknown>),
        );

      if (!isBottomNavItemsArray) {
        return originalMap.call(this, callbackfn, thisArg) as U[];
      }

      const patchedItems = originalMap.call(this, (item) => {
        const navItem = item as Record<string, unknown>;
        if (navItem.href === "/posts/new") {
          return { ...navItem, isCenter: false } as T;
        }
        return item;
      });

      return originalMap.call(patchedItems, callbackfn, thisArg) as U[];
    });

    render(<BottomNav />);

    const links = screen.getAllByRole("link");
    const newPostLink = links.find(
      (link) => link.getAttribute("href") === "/posts/new",
    );

    expect(newPostLink).toBeDefined();
    expect(newPostLink).toHaveClass("w-16");
    const label = newPostLink?.querySelector("span");
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe("");

    mapSpy.mockRestore();
  });

  it("renders clipboard-check icon variant on actions routes", () => {
    setMockPathname("/actions/view");
    const { container } = render(<BottomNav />);

    expect(
      container.querySelector('path[d*="m-6 9l2 2 4-4"]'),
    ).toBeInTheDocument();
  });
});
