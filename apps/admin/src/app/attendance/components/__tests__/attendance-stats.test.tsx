import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceStats } from "../attendance-stats";

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
}));

describe("AttendanceStats", () => {
  it("renders all stat cards with values", () => {
    render(<AttendanceStats total={12} success={10} fail={2} />);

    expect(screen.getByText("선택일 출근")).toBeInTheDocument();
    expect(screen.getByText("출근 성공")).toBeInTheDocument();
    expect(screen.getByText("출근 실패")).toBeInTheDocument();

    expect(screen.getByText("12명")).toBeInTheDocument();
    expect(screen.getByText("10명")).toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();

    expect(screen.getByText("전체 출근 시도")).toBeInTheDocument();
    expect(screen.getByText("정상 출근 처리")).toBeInTheDocument();
    expect(screen.getByText("인증/위치 실패")).toBeInTheDocument();
  });
});
