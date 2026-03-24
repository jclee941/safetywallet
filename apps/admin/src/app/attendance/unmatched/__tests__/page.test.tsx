import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnmatchedRecordsPage from "../page";
import { useUnmatchedRecords } from "@/hooks/use-attendance";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/attendance/unmatched",
}));

vi.mock("@/hooks/use-attendance", () => ({
  useUnmatchedRecords: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <tr className={className}>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableCell: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <td className={className}>{children}</td>,
}));

const mockUseUnmatchedRecords = vi.mocked(useUnmatchedRecords);

const toUnmatchedResult = (
  value: unknown,
): ReturnType<typeof useUnmatchedRecords> => value as never;

describe("UnmatchedRecordsPage", () => {
  beforeEach(() => {
    mockUseUnmatchedRecords.mockReturnValue(
      toUnmatchedResult({ data: { records: [] }, isLoading: false }),
    );
  });

  it("renders loading skeleton rows", () => {
    mockUseUnmatchedRecords.mockReturnValue(
      toUnmatchedResult({ data: undefined, isLoading: true }),
    );

    render(<UnmatchedRecordsPage />);
    expect(screen.getByText("미매칭 기록")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(5);
  });

  it("renders empty state when no records exist", () => {
    render(<UnmatchedRecordsPage />);
    expect(screen.getByText("미매칭 기록이 없습니다")).toBeInTheDocument();
  });

  it("renders table rows with fallback values", () => {
    mockUseUnmatchedRecords.mockReturnValue(
      toUnmatchedResult({
        isLoading: false,
        data: {
          records: [
            {
              id: "r1",
              externalWorkerId: "EXT-7",
              siteName: null,
              source: null,
              checkinAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        },
      }),
    );

    render(<UnmatchedRecordsPage />);

    expect(screen.getByText("외부 ID")).toBeInTheDocument();
    expect(screen.getByText("현장")).toBeInTheDocument();
    expect(screen.getByText("출처")).toBeInTheDocument();
    expect(screen.getByText("출근 시각")).toBeInTheDocument();
    expect(screen.getByText("사유")).toBeInTheDocument();

    expect(screen.getByText("EXT-7")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(1);
    expect(screen.getByText("미등록 사용자")).toBeInTheDocument();
  });
});
