import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppError from "../error";
import GlobalError from "../global-error";
import AttendanceError from "../attendance/error";
import VotesError from "../votes/error";
import PostsError from "../posts/error";
import MembersError from "../members/error";
import SettingsError from "../settings/error";
import PointsError from "../points/error";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
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
}));

describe("app-level error boundaries", () => {
  it("renders app error page and calls reset", () => {
    const reset = vi.fn();
    render(<AppError error={new Error("app failed")} reset={reset} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders global error page and calls reset", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("global failed")} reset={reset} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("feature error boundaries", () => {
  const cases = [
    {
      name: "attendance",
      component: AttendanceError,
      title: "출근 화면에서 오류가 발생했습니다",
    },
    {
      name: "votes",
      component: VotesError,
      title: "투표 화면에서 오류가 발생했습니다",
    },
    {
      name: "posts",
      component: PostsError,
      title: "게시글 화면에서 오류가 발생했습니다",
    },
    {
      name: "members",
      component: MembersError,
      title: "구성원 화면에서 오류가 발생했습니다",
    },
    {
      name: "settings",
      component: SettingsError,
      title: "설정 화면에서 오류가 발생했습니다",
    },
    {
      name: "points",
      component: PointsError,
      title: "포인트 화면에서 오류가 발생했습니다",
    },
  ] as const;

  it.each(cases)("renders $name error with explicit message", (entry) => {
    const reset = vi.fn();
    const Component = entry.component;

    render(<Component error={new Error("문제 발생")} reset={reset} />);

    expect(screen.getByText(entry.title)).toBeInTheDocument();
    expect(screen.getByText("문제 발생")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it.each(cases)("renders $name fallback message when empty", (entry) => {
    const reset = vi.fn();
    const Component = entry.component;

    render(<Component error={new Error("")} reset={reset} />);

    expect(
      screen.getByText("알 수 없는 오류가 발생했습니다."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
