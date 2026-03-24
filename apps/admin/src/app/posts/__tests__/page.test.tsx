import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Category, ReviewStatus } from "@safetywallet/types";
import PostsPage from "../page";
import { useAdminPosts } from "@/hooks/use-api";

const pushMock = vi.fn();

type PostRow = {
  id: string;
  category: Category;
  riskLevel?: string;
  status: ReviewStatus;
  createdAt: string;
  author: { nameMasked: string };
};

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
};

type DataTableProps = {
  columns: Column<PostRow>[];
  data: PostRow[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (item: PostRow) => void;
  emptyMessage?: string;
};

const selectHandlers: Array<(value: string) => void> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/posts",
}));

vi.mock("@/hooks/use-api", () => ({
  useAdminPosts: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: (props: DataTableProps) => {
    return (
      <div>
        <p>{props.emptyMessage}</p>
        <p>{props.searchPlaceholder}</p>
        {props.data[0]
          ? props.columns.map((column) => (
              <div key={column.key}>
                {column.render
                  ? column.render(props.data[0])
                  : String(props.data[0][column.key as keyof PostRow] ?? "")}
              </div>
            ))
          : null}
        <button
          type="button"
          onClick={() => props.data[0] && props.onRowClick?.(props.data[0])}
        >
          row-click
        </button>
      </div>
    );
  },
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Badge: ({ children }: { children: ReactNode; variant?: string }) => (
    <span>{children}</span>
  ),
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => {
    if (onValueChange) {
      selectHandlers.push(onValueChange);
    }
    return <div>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode; value: string }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  Input: ({
    value,
    onChange,
    type,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    type?: string;
  }) => (
    <input
      type={type}
      value={value}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value } })
      }
    />
  ),
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

const mockUseAdminPosts = vi.mocked(useAdminPosts);
const toPostsResult = (value: unknown): ReturnType<typeof useAdminPosts> =>
  value as never;

const samplePost: PostRow = {
  id: "post-1",
  category: Category.HAZARD,
  riskLevel: undefined,
  status: ReviewStatus.PENDING,
  createdAt: "2026-03-02T00:00:00.000Z",
  author: { nameMasked: "홍*동" },
};

describe("PostsPage (__tests__)", () => {
  beforeEach(() => {
    pushMock.mockReset();
    selectHandlers.length = 0;

    mockUseAdminPosts.mockReturnValue(
      toPostsResult({
        data: [],
        isLoading: false,
      }),
    );
  });

  it("renders loading and empty messages", () => {
    mockUseAdminPosts.mockReturnValueOnce(
      toPostsResult({
        data: [],
        isLoading: true,
      }),
    );

    const { rerender } = render(<PostsPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    mockUseAdminPosts.mockReturnValue(
      toPostsResult({
        data: [],
        isLoading: false,
      }),
    );

    rerender(<PostsPage />);
    expect(screen.getByText("조건에 맞는 제보가 없습니다")).toBeInTheDocument();
    expect(screen.getAllByText("제목, 작성자 검색...").length).toBeGreaterThan(
      0,
    );
  });

  it("updates filters via select, switch, date input, and clear button", () => {
    render(<PostsPage />);

    expect(selectHandlers).toHaveLength(3);

    act(() => {
      selectHandlers[0]("HAZARD");
      selectHandlers[1]("HIGH");
      selectHandlers[2]("PENDING");
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    const dateInputs = document.querySelectorAll("input[type='date']");
    fireEvent.change(dateInputs[0], { target: { value: "2026-03-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-03-31" } });

    const latestFilters = mockUseAdminPosts.mock.calls.at(-1)?.[0];
    expect(latestFilters).toMatchObject({
      category: "HAZARD",
      riskLevel: "HIGH",
      reviewStatus: "PENDING",
      isUrgent: true,
    });
    expect(latestFilters?.startDate).toBeInstanceOf(Date);
    expect(latestFilters?.endDate).toBeInstanceOf(Date);

    act(() => {
      selectHandlers[0]("ALL");
      selectHandlers[1]("ALL");
      selectHandlers[2]("ALL");
    });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));

    expect(mockUseAdminPosts.mock.calls.at(-1)?.[0]).toMatchObject({
      category: undefined,
      riskLevel: undefined,
      reviewStatus: undefined,
      isUrgent: false,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("renders mapped columns and navigates on row click", () => {
    mockUseAdminPosts.mockReturnValue(
      toPostsResult({
        data: [samplePost],
        isLoading: false,
      }),
    );

    render(<PostsPage />);

    expect(screen.getByText("제보 관리")).toBeInTheDocument();
    expect(screen.getAllByText("위험요소").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getAllByText("접수됨").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "row-click" }));
    expect(pushMock).toHaveBeenCalledWith("/posts/post-1");
  });
});
