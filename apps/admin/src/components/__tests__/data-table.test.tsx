import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "@/components/data-table";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

interface Row {
  name: string;
  status: string;
}

interface NestedRow {
  user: { profile?: { name?: string } };
  status: string;
}

const columns: Column<Row>[] = [
  { key: "name", header: "이름", sortable: true },
  { key: "status", header: "상태" },
];

const rows: Row[] = [
  { name: "홍길동", status: "대기" },
  { name: "김철수", status: "승인" },
  { name: "이영희", status: "거절" },
];

describe("DataTable", () => {
  it("renders and filters by search input", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        searchable
        searchPlaceholder="검색"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("검색"), {
      target: { value: "김철수" },
    });

    expect(screen.getByText("김철수")).toBeInTheDocument();
    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
  });

  it("sorts by sortable column when header clicked", () => {
    render(<DataTable columns={columns} data={rows} pageSize={10} />);
    fireEvent.click(screen.getByText("이름"));

    const cells = screen
      .getAllByRole("cell")
      .filter((cell) =>
        ["김철수", "이영희", "홍길동"].includes(cell.textContent ?? ""),
      );
    expect(cells[0]).toHaveTextContent("김철수");
  });

  it("calls row click and selection callbacks", () => {
    const onRowClick = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        onRowClick={onRowClick}
        selectable
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(screen.getByText("홍길동"));
    expect(onRowClick).toHaveBeenCalled();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalledWith(rows.slice(0, 2));
  });

  it("selects and deselects an individual row checkbox", () => {
    const onSelectionChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={rows.slice(0, 2)}
        selectable
        onSelectionChange={onSelectionChange}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const firstRowCheckbox = checkboxes[1];

    fireEvent.click(firstRowCheckbox);
    expect(onSelectionChange).toHaveBeenLastCalledWith([rows[0]]);

    fireEvent.click(firstRowCheckbox);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("toggles select-all checkbox on and off", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        selectable
        onSelectionChange={onSelectionChange}
      />,
    );

    const checkbox = screen.getAllByRole("checkbox")[0];
    // Select all
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenCalledWith(rows);

    // Deselect all
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("toggles sort direction when clicking same column twice", () => {
    render(<DataTable columns={columns} data={rows} pageSize={10} />);
    fireEvent.click(screen.getByText("이름"));
    fireEvent.click(screen.getByText("이름"));

    const cells = screen
      .getAllByRole("cell")
      .filter((cell) =>
        ["김철수", "이영희", "홍길동"].includes(cell.textContent ?? ""),
      );
    expect(cells[0]).toHaveTextContent("홍길동");
  });

  it("shows pagination and navigates pages", () => {
    const manyRows: Row[] = Array.from({ length: 15 }, (_, i) => ({
      name: `사용자 ${i}`,
      status: "대기",
    }));

    render(<DataTable columns={columns} data={manyRows} pageSize={5} />);

    expect(screen.getByText("사용자 0")).toBeInTheDocument();
    expect(screen.queryByText("사용자 5")).not.toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    const nextButton = buttons[buttons.length - 1];
    fireEvent.click(nextButton);
    expect(screen.getByText("사용자 5")).toBeInTheDocument();
    expect(screen.queryByText("사용자 0")).not.toBeInTheDocument();

    const prevButtons = screen.getAllByRole("button");
    const prevButton = prevButtons[prevButtons.length - 2];
    fireEvent.click(prevButton);
    expect(screen.getByText("사용자 0")).toBeInTheDocument();
  });

  it("resets selection on search change", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        searchable
        selectable
        onSelectionChange={onSelectionChange}
        searchPlaceholder="검색"
      />,
    );

    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    fireEvent.change(screen.getByPlaceholderText("검색"), {
      target: { value: "김" },
    });
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("renders nested dot-path values and fallback dash", () => {
    const nestedColumns: Column<NestedRow>[] = [
      { key: "user.profile.name", header: "이름" },
      { key: "status", header: "상태" },
    ];
    const nestedRows: NestedRow[] = [
      { user: { profile: { name: "중첩이름" } }, status: "정상" },
      { user: {}, status: "누락" },
    ];

    render(
      <DataTable columns={nestedColumns} data={nestedRows} pageSize={10} />,
    );

    expect(screen.getByText("중첩이름")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="비어 있음"
        pageSize={10}
      />,
    );

    expect(screen.getByText("비어 있음")).toBeInTheDocument();
  });

  it("disables pagination controls on boundaries", () => {
    const manyRows: Row[] = Array.from({ length: 11 }, (_, i) => ({
      name: `행 ${i}`,
      status: "대기",
    }));

    render(<DataTable columns={columns} data={manyRows} pageSize={10} />);

    const prevButton = screen.getByRole("button", { name: "이전 페이지" });
    const nextButton = screen.getByRole("button", { name: "다음 페이지" });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(screen.getByText("행 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("handles select-all without onSelectionChange callback", () => {
    render(<DataTable columns={columns} data={rows} selectable />);

    expect(() => {
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
    }).not.toThrow();
  });

  it("renders custom cell renderer and equal sort values", () => {
    const customColumns: Column<{ name: string; status: string }>[] = [
      {
        key: "name",
        header: "이름",
        sortable: true,
        render: (item) => <strong>{item.name}</strong>,
      },
      { key: "status", header: "상태", sortable: true },
    ];
    const equalRows = [
      { name: "가", status: "같음" },
      { name: "나", status: "같음" },
    ];

    render(
      <DataTable columns={customColumns} data={equalRows} pageSize={10} />,
    );

    fireEvent.click(screen.getByText("상태"));
    expect(screen.getByText("가")).toBeInTheDocument();
    expect(screen.getByText("나")).toBeInTheDocument();
  });

  it("does not paginate when total pages are one", () => {
    render(<DataTable columns={columns} data={rows} pageSize={10} />);
    expect(
      screen.queryByRole("button", { name: "이전 페이지" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다음 페이지" }),
    ).not.toBeInTheDocument();
  });
});
