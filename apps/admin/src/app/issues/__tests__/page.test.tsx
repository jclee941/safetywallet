import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IssuesPage from "../page";
import {
  useIssues,
  useCreateIssue,
  useIssueTemplates,
} from "@/hooks/use-issues-api";

const { toastFn } = vi.hoisted(() => ({ toastFn: vi.fn() }));
const mutateAsyncMock = vi.fn();
let dialogOnOpenChange: ((v: boolean) => void) | undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/issues",
}));

vi.mock("@/hooks/use-issues-api", () => ({
  useIssues: vi.fn(),
  useCreateIssue: vi.fn(),
  useIssueTemplates: vi.fn(),
}));

vi.mock("../issue-template", () => ({
  buildIssueBody: vi.fn(() => "formatted body"),
}));

vi.mock("@safetywallet/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    variant?: string;
  }) => (
    <button
      type={type ?? "button"}
      disabled={disabled}
      data-variant={variant}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    id,
  }: {
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    placeholder?: string;
    id?: string;
  }) => (
    <input
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
    />
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => {
    dialogOnOpenChange = onOpenChange;
    const nodes = Children.toArray(children);
    return (
      <div data-open={open}>
        {nodes[0]}
        {open ? nodes.slice(1) : null}
      </div>
    );
  },
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  DialogTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <>
      {isValidElement(children)
        ? cloneElement(children, {
            onClick: () => dialogOnOpenChange?.(true),
          })
        : children}
    </>
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-value={value} data-testid="select-wrapper">
      <button type="button" onClick={() => onValueChange?.("ops-report")}>
        trigger-select-change
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  useToast: () => ({ toast: toastFn }),
}));

const mockUseIssues = vi.mocked(useIssues);
const mockUseCreateIssue = vi.mocked(useCreateIssue);
const mockUseIssueTemplates = vi.mocked(useIssueTemplates);

const toIssuesResult = (value: unknown): ReturnType<typeof useIssues> =>
  value as never;

const sampleIssues = [
  {
    number: 1,
    title: "테스트 이슈",
    body: "이슈 내용",
    state: "open" as const,
    html_url: "https://github.com/org/repo/issues/1",
    created_at: "2026-03-01T00:00:00Z",
    user: { login: "testuser" },
    labels: [{ name: "bug", color: "d73a4a" }],
  },
];

const sampleTemplates = [
  {
    slug: "bug-report",
    name: "버그 리포트",
    labels: ["bug"],
    fields: [
      {
        id: "description",
        label: "설명",
        type: "textarea" as const,
        required: true,
        placeholder: "버그를 설명하세요",
      },
    ],
  },
];

describe("IssuesPage", () => {
  beforeEach(() => {
    toastFn.mockReset();
    mutateAsyncMock.mockReset();

    mockUseIssues.mockReturnValue(
      toIssuesResult({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      }),
    );
    mockUseCreateIssue.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as never);
    mockUseIssueTemplates.mockReturnValue({
      data: sampleTemplates,
      isLoading: false,
    } as never);
  });

  it("renders page title", () => {
    render(<IssuesPage />);
    expect(screen.getByText("이슈 관리")).toBeInTheDocument();
  });

  it("shows empty state when no issues", () => {
    render(<IssuesPage />);
    expect(screen.getByText("등록된 이슈가 없습니다")).toBeInTheDocument();
  });

  it("renders issue list", () => {
    mockUseIssues.mockReturnValue(
      toIssuesResult({
        data: sampleIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      }),
    );
    render(<IssuesPage />);
    expect(screen.getByText("테스트 이슈")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const refetchMock = vi.fn();
    mockUseIssues.mockReturnValue(
      toIssuesResult({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("API 실패"),
        refetch: refetchMock,
        isFetching: false,
      }),
    );
    render(<IssuesPage />);
    expect(screen.getByText("API 실패")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다시 시도"));
    expect(refetchMock).toHaveBeenCalled();
  });

  it("shows loading template message while templates are loading", () => {
    mockUseIssueTemplates.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<IssuesPage />);
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);

    expect(screen.getByText("템플릿 로딩 중...")).toBeInTheDocument();
  });

  it("initializes dropdown defaults and updates defaults on template change", () => {
    mockUseIssueTemplates.mockReturnValue({
      data: [
        {
          slug: "bug-report",
          name: "버그 리포트",
          labels: ["bug"],
          fields: [
            {
              id: "severity",
              label: "심각도",
              type: "dropdown",
              required: true,
              options: ["low", "high"],
            },
            {
              id: "description",
              label: "설명",
              type: "textarea",
              required: true,
              placeholder: "버그를 설명하세요",
            },
          ],
        },
        {
          slug: "ops-report",
          name: "운영 이슈",
          labels: ["ops"],
          fields: [
            {
              id: "priority",
              label: "우선순위",
              type: "dropdown",
              required: true,
              options: ["p1", "p2"],
            },
            {
              id: "details",
              label: "상세",
              type: "textarea",
              required: true,
              placeholder: "운영 상세를 입력하세요",
            },
          ],
        },
      ],
      isLoading: false,
    } as never);

    render(<IssuesPage />);
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);

    expect(screen.getByText("low")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("select-wrapper")
        .some((node) => node.getAttribute("data-value") === "low"),
    ).toBe(true);

    fireEvent.click(
      screen.getAllByRole("button", { name: "trigger-select-change" })[0],
    );

    expect(
      screen.getByPlaceholderText("운영 상세를 입력하세요"),
    ).toBeInTheDocument();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getByText("p2")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("select-wrapper")
        .some((node) => node.getAttribute("data-value") === "p1"),
    ).toBe(true);
  });

  it("shows fallback error message for non-Error failures and fetching spinner", () => {
    mockUseIssues.mockReturnValue(
      toIssuesResult({
        data: undefined,
        isLoading: false,
        isError: true,
        error: "bad-response",
        refetch: vi.fn(),
        isFetching: true,
      }),
    );

    render(<IssuesPage />);

    expect(screen.getByText("이슈를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });

  it("disables submit when required fields are missing", () => {
    render(<IssuesPage />);
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    expect(submitBtn).toBeDisabled();
  });

  it("submits new issue via dialog form", async () => {
    mutateAsyncMock.mockResolvedValue({});
    render(<IssuesPage />);

    // Click "이슈 등록" button to open dialog
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);

    // Fill title
    const titleInput = screen.getByPlaceholderText("이슈 제목을 입력하세요");
    fireEvent.change(titleInput, { target: { value: "새 이슈" } });

    // Fill required textarea field
    const textarea = screen.getByPlaceholderText("버그를 설명하세요");
    fireEvent.change(textarea, { target: { value: "상세 설명" } });

    // Submit
    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "새 이슈",
          body: "formatted body",
          labels: ["bug"],
          assignCodex: true,
        }),
      );
    });
  });

  it("submits with assignCodex=false when checkbox is unchecked", async () => {
    mutateAsyncMock.mockResolvedValue({});
    render(<IssuesPage />);

    fireEvent.click(screen.getAllByText("이슈 등록")[0]);
    fireEvent.change(screen.getByPlaceholderText("이슈 제목을 입력하세요"), {
      target: { value: "할당 끄기" },
    });
    fireEvent.change(screen.getByPlaceholderText("버그를 설명하세요"), {
      target: { value: "설명" },
    });
    fireEvent.click(screen.getByLabelText("Codex 자동 할당"));

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ assignCodex: false }),
      );
    });
  });

  it("shows toast on successful issue creation", async () => {
    mutateAsyncMock.mockResolvedValue({});
    render(<IssuesPage />);

    fireEvent.click(screen.getAllByText("이슈 등록")[0]);
    const titleInput = screen.getByPlaceholderText("이슈 제목을 입력하세요");
    fireEvent.change(titleInput, { target: { value: "성공 이슈" } });
    const textarea = screen.getByPlaceholderText("버그를 설명하세요");
    fireEvent.change(textarea, { target: { value: "설명" } });

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({ description: "이슈가 등록되었습니다." }),
      );
    });
  });

  it("shows error toast on failed issue creation", async () => {
    mutateAsyncMock.mockRejectedValue(new Error("등록 실패"));
    render(<IssuesPage />);

    fireEvent.click(screen.getAllByText("이슈 등록")[0]);
    const titleInput = screen.getByPlaceholderText("이슈 제목을 입력하세요");
    fireEvent.change(titleInput, { target: { value: "실패 이슈" } });
    const textarea = screen.getByPlaceholderText("버그를 설명하세요");
    fireEvent.change(textarea, { target: { value: "설명" } });

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "등록 실패",
        }),
      );
    });
  });

  it("shows fallback destructive toast for non-Error mutation failure", async () => {
    mutateAsyncMock.mockRejectedValue("oops");
    render(<IssuesPage />);

    fireEvent.click(screen.getAllByText("이슈 등록")[0]);
    fireEvent.change(screen.getByPlaceholderText("이슈 제목을 입력하세요"), {
      target: { value: "실패 이슈2" },
    });
    fireEvent.change(screen.getByPlaceholderText("버그를 설명하세요"), {
      target: { value: "설명" },
    });

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "이슈 등록에 실패했습니다.",
        }),
      );
    });
  });

  it("renders closed issue without labels/body card content", () => {
    mockUseIssues.mockReturnValue(
      toIssuesResult({
        data: [
          {
            number: 2,
            title: "닫힌 이슈",
            body: "",
            state: "closed",
            html_url: "https://github.com/org/repo/issues/2",
            created_at: "2026-03-02T00:00:00Z",
            user: undefined,
            labels: [],
          },
        ],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      }),
    );

    render(<IssuesPage />);
    expect(screen.getByRole("link", { name: "닫힌 이슈" })).toBeInTheDocument();
    expect(screen.queryByText("bug")).not.toBeInTheDocument();
  });

  it("shows pending submit state text", () => {
    mockUseCreateIssue.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: true,
    } as never);

    render(<IssuesPage />);
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);

    expect(screen.getByText("등록 중...")).toBeInTheDocument();
  });

  it("does not submit when no template is available", async () => {
    mockUseIssueTemplates.mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as never);

    render(<IssuesPage />);
    fireEvent.click(screen.getAllByText("이슈 등록")[0]);
    fireEvent.change(screen.getByPlaceholderText("이슈 제목을 입력하세요"), {
      target: { value: "템플릿 없음" },
    });

    const submitButtons = screen.getAllByText("이슈 등록");
    const submitBtn = submitButtons.find(
      (el) => el.getAttribute("type") === "submit",
    );
    expect(submitBtn).toBeDisabled();
    await waitFor(() => {
      expect(mutateAsyncMock).not.toHaveBeenCalled();
    });
  });
});
