import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadingState } from "@/app/actions/view/loading-state";

vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom</div>,
}));
vi.mock("@safetywallet/ui", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("LoadingState", () => {
  it("renders shell and loading skeletons", () => {
    render(<LoadingState />);

    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("bottom")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
  });
});
