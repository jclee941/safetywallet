import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewVotePage from "../page";

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={props.type ?? "button"} {...props} />
  ),
}));

describe("new vote page", () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
  });

  it("goes back when back button is clicked", () => {
    render(<NewVotePage />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when month is empty", () => {
    render(<NewVotePage />);
    fireEvent.click(screen.getByRole("button", { name: "투표 생성" }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to detail page when month is selected", () => {
    render(<NewVotePage />);
    fireEvent.change(screen.getByLabelText("투표 월"), {
      target: { value: "2026-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "투표 생성" }));
    expect(pushMock).toHaveBeenCalledWith("/votes/2026-02");
  });

  it("handles direct form submit event", () => {
    const { container } = render(<NewVotePage />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("투표 월"), {
      target: { value: "2026-12" },
    });
    fireEvent.submit(form!);
    expect(pushMock).toHaveBeenCalledWith("/votes/2026-12");
  });
});
