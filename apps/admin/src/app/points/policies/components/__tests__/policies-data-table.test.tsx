import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PoliciesDataTable } from "../policies-data-table";

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode;
    onClick?: (event: { stopPropagation: () => void }) => void;
    className?: string;
  }) => (
    <button
      type="button"
      data-class={className}
      onClick={() => onClick?.({ stopPropagation: vi.fn() })}
    >
      {children}
    </button>
  ),
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: ({
    data,
    columns,
    searchPlaceholder,
    searchable,
  }: {
    data: Array<Record<string, unknown>>;
    columns: Array<{
      key: string;
      render?: (row: Record<string, unknown>) => ReactNode;
      header: string;
    }>;
    searchPlaceholder?: string;
    searchable?: boolean;
  }) => (
    <div>
      <p>{searchable ? "searchable" : "not-searchable"}</p>
      <p>{searchPlaceholder}</p>
      {data.map((row) => (
        <div key={String(row.id)}>
          {columns.map((column) => (
            <div key={`${String(row.id)}-${column.key}`}>
              {column.render?.(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

describe("PoliciesDataTable", () => {
  it("renders policy cells and triggers edit/delete actions", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <PoliciesDataTable
        policies={[
          {
            id: "p1",
            siteId: "s1",
            reasonCode: "SAFE",
            name: "안전",
            description: null,
            defaultAmount: 10,
            minAmount: 1,
            maxAmount: 20,
            dailyLimit: 2,
            monthlyLimit: 5,
            isActive: true,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "p2",
            siteId: "s1",
            reasonCode: "WARN",
            name: "경고",
            description: null,
            defaultAmount: 3,
            minAmount: null,
            maxAmount: null,
            dailyLimit: null,
            monthlyLimit: null,
            isActive: false,
            createdAt: "",
            updatedAt: "",
          },
        ]}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("searchable")).toBeInTheDocument();
    expect(screen.getByText("정책명 또는 코드로 검색...")).toBeInTheDocument();
    expect(screen.getByText("10 P")).toBeInTheDocument();
    expect(screen.getByText("1 ~ 20")).toBeInTheDocument();
    expect(screen.getByText("일: 2회")).toBeInTheDocument();
    expect(screen.getByText("월: 5회")).toBeInTheDocument();
    expect(screen.getByText("일: -")).toBeInTheDocument();
    expect(screen.getByText("월: -")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("비활성")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
    expect(onDelete).toHaveBeenCalledWith("p1");
  });
});
