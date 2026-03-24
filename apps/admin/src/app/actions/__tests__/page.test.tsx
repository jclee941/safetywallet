import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActionsPage from "../page";
import { useActionItems } from "@/hooks/use-api";
import { useActionImages } from "@/hooks/use-action-ai-analysis";

interface ActionItem {
  id: string;
  postId: string;
  description: string;
  status: string;
  assignee?: { nameMasked: string };
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
}

interface MockColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface MockDataTableProps<T extends { id?: string }> {
  columns: MockColumn<T>[];
  data: T[];
  emptyMessage?: string;
}

const imageState = {
  data: [] as Array<{
    id: string;
    fileUrl: string;
    imageType: "BEFORE" | "AFTER" | null;
  }>,
  isLoading: false,
};

let latestTableDataCount = 0;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/actions",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Bot: () => <span data-testid="icon-bot" />,
  Clock: () => <span data-testid="icon-clock" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  ExternalLink: () => <span data-testid="icon-external" />,
}));

vi.mock("@/hooks/use-api", () => ({
  useActionItems: vi.fn(),
}));

vi.mock("@/hooks/use-action-ai-analysis", () => ({
  useActionImages: vi.fn(),
}));

vi.mock("../components/action-image-ai-analysis", () => ({
  ActionImageAiAnalysis: ({
    actionId,
    imageId,
  }: {
    actionId: string;
    imageId: string;
  }) => <div>{`ai-card:${actionId}:${imageId}`}</div>,
}));

vi.mock("../components/before-after-comparison-card", () => ({
  BeforeAfterComparisonCard: ({ actionId }: { actionId: string }) => (
    <div>{`compare-card:${actionId}`}</div>
  ),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: <T extends { id?: string }>(props: MockDataTableProps<T>) => {
    latestTableDataCount = props.data.length;
    return (
      <div>
        <p>{props.emptyMessage}</p>
        <div data-testid="table-data-count">{String(props.data.length)}</div>
        {props.data.map((item, rowIndex) => (
          <div key={item.id ?? `row-${rowIndex}`}>
            {props.columns.map((column) => (
              <div key={`${String(column.key)}-${rowIndex}`}>
                {column.render
                  ? column.render(item)
                  : String(item[column.key as keyof T] ?? "")}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("@safetywallet/ui", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-class={className ?? ""} data-variant={variant ?? ""}>
      {children}
    </span>
  ),
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    disabled?: boolean;
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onOpenChange?.(true)}>
          keep-dialog-open
        </button>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          close-dialog
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Skeleton: () => <div data-testid="skeleton" />,
}));

const mockUseActionItems = vi.mocked(useActionItems);
const mockUseActionImages = vi.mocked(useActionImages);

const toActionItemsResult = (
  value: unknown,
): ReturnType<typeof useActionItems> => value as never;

const toActionImagesResult = (
  value: unknown,
): ReturnType<typeof useActionImages> => value as never;

function buildActions(): ActionItem[] {
  return [
    {
      id: "a1",
      postId: "p1",
      description: "과거 기한 배정",
      status: "ASSIGNED",
      assignee: { nameMasked: "김*수" },
      dueDate: "2026-01-08T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a2",
      postId: "p2",
      description: "임박 작업",
      status: "IN_PROGRESS",
      dueDate: "2026-01-12T00:00:00.000Z",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "a3",
      postId: "p3",
      description: "여유 작업",
      status: "IN_PROGRESS",
      dueDate: "2026-01-20T00:00:00.000Z",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "a4",
      postId: "p4",
      description: "완료 작업",
      status: "COMPLETED",
      dueDate: "2026-01-07T00:00:00.000Z",
      createdAt: "2026-01-04T00:00:00.000Z",
    },
    {
      id: "a5",
      postId: "p5",
      description: "검증 완료",
      status: "VERIFIED",
      dueDate: "2026-01-09T00:00:00.000Z",
      createdAt: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "a6",
      postId: "p6",
      description: "미지정",
      status: "NONE",
      createdAt: "2026-01-06T00:00:00.000Z",
    },
    {
      id: "a7",
      postId: "p7",
      description: "명시적 초과",
      status: "OVERDUE",
      createdAt: "2026-01-07T00:00:00.000Z",
    },
    {
      id: "a8",
      postId: "p8",
      description: "",
      status: "UNKNOWN",
      createdAt: "2026-01-08T00:00:00.000Z",
    },
  ];
}

describe("ActionsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));

    latestTableDataCount = 0;
    imageState.data = [];
    imageState.isLoading = false;

    mockUseActionItems.mockReturnValue(
      toActionItemsResult({ data: [], isLoading: false }),
    );

    mockUseActionImages.mockImplementation(() =>
      toActionImagesResult({
        data: imageState.data,
        isLoading: imageState.isLoading,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading skeleton state", () => {
    mockUseActionItems.mockReturnValueOnce(
      toActionItemsResult({ data: undefined, isLoading: true }),
    );

    render(<ActionsPage />);

    expect(screen.getByText("조치 현황")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(4);
  });

  it("renders stats, table branches, and filter interactions", () => {
    const actions = buildActions();
    mockUseActionItems.mockReturnValue(
      toActionItemsResult({ data: actions, isLoading: false }),
    );

    render(<ActionsPage />);

    expect(screen.getByText(/2건/)).toBeInTheDocument();
    expect(screen.getByText("(내용 없음)")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("조치 항목이 없습니다")).toBeInTheDocument();

    expect(screen.getByText(/일 초과\)/)).toBeInTheDocument();
    expect(screen.getByText(/일 남음\)/)).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);

    const inProgressButton = screen.getByRole("button", {
      name: /진행 중 \(2\)/,
    });
    fireEvent.click(inProgressButton);
    expect(latestTableDataCount).toBe(2);

    const allButton = screen.getByRole("button", { name: /전체 \(8\)/ });
    fireEvent.click(allButton);
    expect(latestTableDataCount).toBe(8);

    expect(screen.queryByText("조치 사진 AI 분석")).not.toBeInTheDocument();
  });

  it("renders dialog loading, empty, and result states and closes dialog", () => {
    mockUseActionItems.mockReturnValue(
      toActionItemsResult({
        data: [
          {
            id: "a9",
            postId: "p9",
            description: "이미지 분석 대상",
            status: "ASSIGNED",
            createdAt: "2026-01-09T00:00:00.000Z",
          },
        ],
        isLoading: false,
      }),
    );

    imageState.isLoading = true;
    imageState.data = [];

    const { rerender } = render(<ActionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "분석" }));
    expect(screen.getByText("조치 사진 AI 분석")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(2);

    imageState.isLoading = false;
    imageState.data = [];
    rerender(<ActionsPage />);
    expect(
      screen.getByText("등록된 조치 이미지가 없습니다."),
    ).toBeInTheDocument();

    imageState.data = [
      { id: "img-before", fileUrl: "before.jpg", imageType: "BEFORE" },
      { id: "img-after", fileUrl: "after.jpg", imageType: "AFTER" },
    ];
    rerender(<ActionsPage />);

    expect(screen.getByText("compare-card:a9")).toBeInTheDocument();
    expect(screen.getByText("ai-card:a9:img-before")).toBeInTheDocument();
    expect(screen.getByText("ai-card:a9:img-after")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "keep-dialog-open" }));
    expect(screen.getByText("조치 사진 AI 분석")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close-dialog" }));
    expect(screen.queryByText("조치 사진 AI 분석")).not.toBeInTheDocument();
  });
});
