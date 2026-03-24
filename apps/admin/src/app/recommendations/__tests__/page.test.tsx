import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RecommendationsPage from "../page";
import {
  useRecommendations,
  useExportRecommendations,
} from "@/hooks/use-recommendations";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/recommendations",
}));

vi.mock("@/hooks/use-recommendations", () => ({
  useRecommendations: vi.fn(),
  useExportRecommendations: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    type?: string;
  }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
    />
  ),
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

const mockUseRecommendations = vi.mocked(useRecommendations);
const mockExportFn = vi.fn();
const mockUseExportRecommendations = vi.mocked(useExportRecommendations);

const toResult = (value: unknown): ReturnType<typeof useRecommendations> =>
  value as never;

const sampleItems = [
  {
    id: "rec-1",
    siteId: "site-1",
    siteName: "현장A",
    recommenderId: "user-1",
    recommenderName: "김철수",
    recommenderCompany: "A건설",
    recommendedName: "이영희",
    tradeType: "철근",
    reason: "안전 모범",
    recommendationDate: "2026-03-01",
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "rec-2",
    siteId: "site-1",
    siteName: "현장A",
    recommenderId: "user-2",
    recommenderName: null,
    recommenderCompany: null,
    recommendedName: "박민수",
    tradeType: "전기",
    reason: "위험 발견",
    recommendationDate: "2026-03-02",
    createdAt: "2026-03-02T00:00:00Z",
  },
];

describe("RecommendationsPage", () => {
  beforeEach(() => {
    mockExportFn.mockReset();
    mockUseExportRecommendations.mockReturnValue(mockExportFn);
    mockUseRecommendations.mockReturnValue(
      toResult({ data: undefined, isLoading: false }),
    );
  });

  it("renders page title", () => {
    render(<RecommendationsPage />);
    expect(screen.getByText("우수근로자 추천 내역")).toBeInTheDocument();
  });

  it("shows skeletons when loading", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({ data: undefined, isLoading: true }),
    );
    render(<RecommendationsPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(5);
  });

  it("shows empty state when no items", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
        isLoading: false,
      }),
    );
    render(<RecommendationsPage />);
    expect(screen.getByText("추천 내역이 없습니다")).toBeInTheDocument();
  });

  it("renders data table with recommendation items", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
        isLoading: false,
      }),
    );
    render(<RecommendationsPage />);
    expect(screen.getByText("이영희")).toBeInTheDocument();
    expect(screen.getByText("박민수")).toBeInTheDocument();
    expect(screen.getByText("철근")).toBeInTheDocument();
    expect(screen.getByText("김철수")).toBeInTheDocument();
    expect(screen.getByText("A건설")).toBeInTheDocument();
    // null recommender shows "-"
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows pagination when multiple pages", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
        },
        isLoading: false,
      }),
    );
    render(<RecommendationsPage />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("moves between pages using pagination buttons", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 60, totalPages: 3 },
        },
        isLoading: false,
      }),
    );

    render(<RecommendationsPage />);

    const paginationButtons = document.querySelectorAll(
      'button[data-size="sm"]',
    );
    const prevButton = paginationButtons[0] as HTMLButtonElement;
    const nextButton = paginationButtons[1] as HTMLButtonElement;

    expect(prevButton).toBeDisabled();
    fireEvent.click(nextButton);

    const lastCall = mockUseRecommendations.mock.calls.at(-1);
    expect(lastCall).toEqual([
      2,
      20,
      undefined,
      undefined,
      "RECOMMENDED_NAME_ASC",
    ]);
  });

  it("updates sort and date filters, resets page, and clears filters", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
        },
        isLoading: false,
      }),
    );

    render(<RecommendationsPage />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "CREATED_DESC" },
    });
    expect(mockUseRecommendations.mock.calls.at(-1)).toEqual([
      1,
      20,
      undefined,
      undefined,
      "CREATED_DESC",
    ]);

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-01-31" } });

    expect(mockUseRecommendations.mock.calls.at(-1)).toEqual([
      1,
      20,
      "2026-01-01",
      "2026-01-31",
      "CREATED_DESC",
    ]);

    fireEvent.click(screen.getByText("초기화"));

    expect(mockUseRecommendations.mock.calls.at(-1)).toEqual([
      1,
      20,
      undefined,
      undefined,
      "CREATED_DESC",
    ]);
  });

  it("calls export function on CSV button click", () => {
    render(<RecommendationsPage />);
    fireEvent.click(screen.getByText("CSV 내보내기"));
    expect(mockExportFn).toHaveBeenCalledWith(undefined, undefined);
  });

  it("passes selected date range to export", () => {
    render(<RecommendationsPage />);

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-02-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-02-15" } });

    fireEvent.click(screen.getByText("CSV 내보내기"));
    expect(mockExportFn).toHaveBeenCalledWith("2026-02-01", "2026-02-15");
  });

  it("shows reset button when date filter is set", () => {
    render(<RecommendationsPage />);
    // No reset button initially
    expect(screen.queryByText("초기화")).not.toBeInTheDocument();

    // Date inputs are type="date" — no "textbox" role, use direct DOM query
    const inputs = document.querySelectorAll('input[type="date"]');
    expect(inputs.length).toBe(2);

    fireEvent.change(inputs[0], { target: { value: "2026-01-01" } });
    expect(screen.getByText("초기화")).toBeInTheDocument();
  });

  it("renders table headers correctly", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
        isLoading: false,
      }),
    );
    render(<RecommendationsPage />);
    expect(screen.getByText("추천된 사람")).toBeInTheDocument();
    expect(screen.getByText("공종")).toBeInTheDocument();
    expect(screen.getByText("추천한 사람")).toBeInTheDocument();
    expect(screen.getByText("추천일")).toBeInTheDocument();
    expect(screen.getByText("추천 사유")).toBeInTheDocument();
  });

  it("displays total count when data is available", () => {
    mockUseRecommendations.mockReturnValue(
      toResult({
        data: {
          items: sampleItems,
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
        isLoading: false,
      }),
    );
    render(<RecommendationsPage />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
