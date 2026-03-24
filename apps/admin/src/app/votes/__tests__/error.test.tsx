import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VotesError from "../error";

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe("VotesError", () => {
  it("renders error message and retry button", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("투표 로드 실패"), {
      digest: "d123",
    });

    render(<VotesError error={error} reset={reset} />);

    expect(
      screen.getByText("투표 화면에서 오류가 발생했습니다"),
    ).toBeInTheDocument();
    expect(screen.getByText("투표 로드 실패")).toBeInTheDocument();
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });

  it("shows fallback message when error.message is empty", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error(""), { digest: undefined });

    render(<VotesError error={error} reset={reset} />);

    expect(
      screen.getByText("알 수 없는 오류가 발생했습니다."),
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    const error = Object.assign(new Error("err"), { digest: undefined });

    render(<VotesError error={error} reset={reset} />);
    fireEvent.click(screen.getByText("다시 시도"));

    expect(reset).toHaveBeenCalledOnce();
  });
});
