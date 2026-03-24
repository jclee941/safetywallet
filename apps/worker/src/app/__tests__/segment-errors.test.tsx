import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActionsError from "@/app/actions/error";
import AppError from "@/app/error";
import EducationError from "@/app/education/error";
import PostsError from "@/app/posts/error";
import ProfileError from "@/app/profile/error";
import VotesError from "@/app/votes/error";

vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));

describe("segment error boundaries", () => {
  it("renders actions error boundary and calls reset", () => {
    const reset = vi.fn();
    render(<ActionsError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders root app error boundary and development error message", () => {
    const reset = vi.fn();
    vi.stubEnv("NODE_ENV", "development");

    render(<AppError error={new Error("root-boom")} reset={reset} />);

    expect(screen.getByText("common.errorOccurred")).toBeInTheDocument();
    expect(screen.getByText("root-boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(reset).toHaveBeenCalledTimes(1);

    vi.unstubAllEnvs();
  });

  it("renders education error boundary and calls reset", () => {
    const reset = vi.fn();
    render(<EducationError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders translated posts error boundary and calls reset", () => {
    const reset = vi.fn();
    render(<PostsError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("common.errorOccurred")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders translated profile error boundary and calls reset", () => {
    const reset = vi.fn();
    render(<ProfileError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("common.errorOccurred")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders translated votes error boundary and calls reset", () => {
    const reset = vi.fn();
    render(<VotesError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("common.errorOccurred")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
