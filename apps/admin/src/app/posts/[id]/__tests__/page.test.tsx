import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page, { generateStaticParams } from "../page";

vi.mock("../post-detail", () => ({
  default: () => <div data-testid="post-detail-page" />,
}));

describe("posts detail wrapper page", () => {
  it("returns static placeholder params", () => {
    expect(generateStaticParams()).toEqual([{ id: "__placeholder" }]);
  });

  it("renders client detail page", () => {
    render(<Page />);
    expect(screen.getByTestId("post-detail-page")).toBeInTheDocument();
  });
});
