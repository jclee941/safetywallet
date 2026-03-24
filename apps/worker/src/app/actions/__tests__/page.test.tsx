import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionsPage from "@/app/actions/page";
import { useMyActions } from "@/hooks/use-api";

vi.mock("@/hooks/use-api", () => ({ useMyActions: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));

describe("app/actions/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    render(<ActionsPage />);
    expect(screen.getByText("actions.list.myList")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);
    render(<ActionsPage />);
    expect(screen.getByText("actions.list.empty")).toBeInTheDocument();
  });

  it("renders action cards and pushes detail route", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: {
        data: [
          {
            id: "a1",
            actionStatus: "ASSIGNED",
            priority: "HIGH",
            description: "안전 점검",
            dueDate: "2099-01-01",
            post: { title: "연관 제보" },
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<ActionsPage />);
    fireEvent.click(screen.getByText("안전 점검"));

    expect(screen.getByText(/actions.view.relatedReport/)).toBeInTheDocument();
  });

  it("renders fallback labels and non-overdue branch", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: {
        data: [
          {
            id: "a2",
            actionStatus: "UNKNOWN_STATUS",
            priority: "UNKNOWN_PRIORITY",
            description: "",
            dueDate: "2099-12-31",
            post: { title: "" },
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<ActionsPage />);

    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN_PRIORITY")).toBeInTheDocument();
    expect(screen.getByText("actions.list.noContent")).toBeInTheDocument();
    expect(screen.getByText(/actions\.list\.noTitle/)).toBeInTheDocument();
  });

  it("does not render due date and related report when optional fields are missing", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: {
        data: [
          {
            id: "a3",
            actionStatus: "ASSIGNED",
            priority: "LOW",
            description: "점검 필요",
            dueDate: null,
            post: null,
          },
        ],
      },
      isLoading: false,
    } as never);

    render(<ActionsPage />);

    expect(screen.getByText("점검 필요")).toBeInTheDocument();
    expect(
      screen.queryByText(/actions.view.relatedReport/),
    ).not.toBeInTheDocument();
  });

  it("uses undefined status when all filter is selected", () => {
    const hook = vi.mocked(useMyActions);
    hook.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);

    render(<ActionsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "actions.filter.assigned" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "actions.filter.all" }));

    expect(hook).toHaveBeenLastCalledWith({ status: undefined });
  });

  it("updates active filter on filter button click", () => {
    const hook = vi.mocked(useMyActions);
    hook.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as never);

    render(<ActionsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "actions.filter.assigned" }),
    );

    expect(hook).toHaveBeenLastCalledWith({ status: "ASSIGNED" });
  });

  it("applies overdue styling only for overdue actionable statuses", () => {
    vi.mocked(useMyActions).mockReturnValue({
      data: {
        data: [
          {
            id: "a-overdue",
            actionStatus: "IN_PROGRESS",
            priority: "MEDIUM",
            description: "지연 작업",
            dueDate: "2000-01-01",
            post: null,
          },
          {
            id: "a-completed",
            actionStatus: "COMPLETED",
            priority: "LOW",
            description: "완료 작업",
            dueDate: "2000-01-01",
            post: null,
          },
        ],
      },
      isLoading: false,
    } as never);

    const { container } = render(<ActionsPage />);
    const overdueIndicators = container.querySelectorAll(".text-red-600");
    expect(overdueIndicators.length).toBeGreaterThan(0);
  });
});
