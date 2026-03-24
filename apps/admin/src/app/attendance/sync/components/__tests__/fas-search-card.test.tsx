import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FasSearchCard } from "../fas-search-card";
import { useSearchFasMariadb } from "@/hooks/use-fas-sync";

interface TableProps<T extends object> {
  columns: Array<{
    key: keyof T | string;
    render?: (item: T) => ReactNode;
  }>;
  data: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

vi.mock("@/hooks/use-fas-sync", () => ({
  useSearchFasMariadb: vi.fn(),
}));

vi.mock("@/components/data-table", () => ({
  DataTable: <T extends object>({
    columns,
    data,
    searchPlaceholder,
    emptyMessage,
  }: TableProps<T>) => (
    <div data-testid="data-table">
      <span>{searchPlaceholder}</span>
      <span>{emptyMessage}</span>
      {data.map((item) => (
        <div key={JSON.stringify(item)}>
          {columns.map((col) => (
            <div key={String(col.key)}>
              {col.render
                ? col.render(item)
                : String(
                    (item as Record<string, unknown>)[String(col.key)] ?? "-",
                  )}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
  Input: ({
    id,
    value,
    placeholder,
    onChange,
    onKeyDown,
  }: {
    id?: string;
    value?: string;
    placeholder?: string;
    onChange?: (e: { target: { value: string } }) => void;
    onKeyDown?: (e: { key: string }) => void;
  }) => (
    <input
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      onKeyDown={(e) => onKeyDown?.({ key: e.key })}
    />
  ),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

const mockUseSearchFasMariadb = vi.mocked(useSearchFasMariadb);

const toSearchResult = (
  value: unknown,
): ReturnType<typeof useSearchFasMariadb> => value as never;

describe("FasSearchCard", () => {
  beforeEach(() => {
    mockUseSearchFasMariadb.mockReturnValue(
      toSearchResult({ data: undefined, isLoading: false }),
    );
  });

  it("keeps search disabled without inputs", () => {
    render(<FasSearchCard />);
    expect(mockUseSearchFasMariadb).toHaveBeenCalledWith({});

    const searchButton = screen.getByRole("button", { name: "검색" });
    expect(searchButton).toBeDisabled();

    fireEvent.click(searchButton);
    expect(mockUseSearchFasMariadb).toHaveBeenCalledTimes(1);
  });

  it("searches by name and renders results table", () => {
    mockUseSearchFasMariadb
      .mockReturnValueOnce(
        toSearchResult({ data: undefined, isLoading: false }),
      )
      .mockReturnValue(
        toSearchResult({
          isLoading: false,
          data: {
            count: 2,
            query: { name: "김철수" },
            results: [
              {
                emplCd: "1001",
                name: "김철수",
                partCd: "P",
                companyName: "A업체",
                phone: "010-1111-1111",
                socialNo: "",
                gojoCd: "",
                jijoCd: "",
                careCd: "",
                roleCd: "",
                stateFlag: "W",
                entrDay: "2026-01-01",
                retrDay: "",
                rfid: "",
                violCnt: 0,
                updatedAt: "",
                isActive: true,
              },
              {
                emplCd: "1002",
                name: "이영희",
                partCd: "P",
                companyName: "B업체",
                phone: "",
                socialNo: "",
                gojoCd: "",
                jijoCd: "",
                careCd: "",
                roleCd: "",
                stateFlag: "X",
                entrDay: "",
                retrDay: "",
                rfid: "",
                violCnt: 0,
                updatedAt: "",
                isActive: false,
              },
            ],
          },
        }),
      );

    render(<FasSearchCard />);

    fireEvent.change(screen.getByPlaceholderText("근로자 이름"), {
      target: { value: "김철수" },
    });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(mockUseSearchFasMariadb).toHaveBeenLastCalledWith({
      name: "김철수",
      phone: undefined,
    });
    expect(screen.getByText("검색 결과: 2건")).toBeInTheDocument();
    expect(screen.getByText("김철수")).toBeInTheDocument();
    expect(screen.getByText("이영희")).toBeInTheDocument();
    expect(screen.getByText("재직")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getByText("이름 또는 업체 검색...")).toBeInTheDocument();
  });

  it("runs search on Enter key and handles loading button text", () => {
    mockUseSearchFasMariadb
      .mockReturnValueOnce(
        toSearchResult({ data: undefined, isLoading: false }),
      )
      .mockReturnValue(toSearchResult({ data: undefined, isLoading: true }));

    render(<FasSearchCard />);

    fireEvent.change(screen.getByPlaceholderText("전화번호"), {
      target: { value: "01012345678" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("전화번호"), {
      key: "Enter",
    });

    expect(mockUseSearchFasMariadb).toHaveBeenLastCalledWith({
      name: undefined,
      phone: "01012345678",
    });
    expect(screen.getByRole("button", { name: "검색 중..." })).toBeDisabled();
  });
});
