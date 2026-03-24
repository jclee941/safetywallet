import { createContext, useContext, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VoteDetailPage from "../vote-detail";
import { apiFetch } from "@/lib/api";

const pushMock = vi.fn();
const toastMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const mutateMock = vi.fn();
const alertDialogOpenStates: boolean[] = [];

const AlertDialogContext = createContext<{
  onOpenChange?: (open: boolean) => void;
}>({});

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const mockApiFetch = vi.mocked(apiFetch);
let currentMonthParam = "2099-12";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: currentMonthParam }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string }) => string) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableBody: ({ children }: { children: ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (typeof open === "boolean") {
      alertDialogOpenStates.push(open);
    }
    return (
      <AlertDialogContext.Provider value={{ onOpenChange }}>
        <div>{children}</div>
      </AlertDialogContext.Provider>
    );
  },
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <AlertDialogCancelButton onClick={onClick} {...props}>
      {children}
    </AlertDialogCancelButton>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  useToast: () => ({ toast: toastMock }),
}));

function AlertDialogCancelButton({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useContext(AlertDialogContext);
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        onOpenChange?.(false);
      }}
    >
      {children}
    </button>
  );
}

const baseResults = [
  {
    candidateId: "c1",
    voteCount: 5,
    rank: 1,
    user: {
      id: "u1",
      nameMasked: "홍길동",
      name: "홍길동",
      companyName: "안전건설",
      tradeType: "전기",
    },
  },
];

describe("vote detail page", () => {
  beforeEach(() => {
    currentMonthParam = "2099-12";
    pushMock.mockReset();
    toastMock.mockReset();
    invalidateQueriesMock.mockReset();
    mutateMock.mockReset();
    mockApiFetch.mockReset();
    alertDialogOpenStates.length = 0;

    useQueryMock.mockReturnValue({ data: baseResults, isLoading: false });
    useMutationMock.mockImplementation(
      ({ onSuccess }: { onSuccess?: () => void }) => ({
        mutate: (_id: string) => {
          mutateMock();
          onSuccess?.();
        },
      }),
    );

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        const element = document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          tagName,
        );
        if (tagName === "a") {
          Object.defineProperty(element, "click", {
            value: vi.fn(),
          });
        }
        return element;
      },
    );
  });

  it("shows loading state", () => {
    useQueryMock.mockReturnValueOnce({ data: undefined, isLoading: true });
    render(<VoteDetailPage />);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders details and handles navigation and csv export", () => {
    render(<VoteDetailPage />);

    expect(screen.getByText("2099-12 투표 현황")).toBeInTheDocument();
    expect(screen.getByText("총 5명 참여")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(pushMock).toHaveBeenCalledWith("/votes");

    fireEvent.click(screen.getByRole("button", { name: "결과 내보내기" }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "CSV 파일이 다운로드되었습니다." }),
    );

    fireEvent.click(screen.getByRole("button", { name: "후보 등록" }));
    expect(pushMock).toHaveBeenCalledWith("/votes/2099-12/candidates/new");
  });

  it("deletes candidate and invalidates query", async () => {
    render(<VoteDetailPage />);

    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["votes", "results", "site-1", "2099-12"],
      }),
    );
  });

  it("resets delete dialog state when dialog closes", async () => {
    render(<VoteDetailPage />);

    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(deleteButtons[0]);
    expect(alertDialogOpenStates).toContain(true);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(alertDialogOpenStates.at(-1)).toBe(false);
    });
  });

  it("shows destructive toast when delete fails", async () => {
    useMutationMock.mockImplementationOnce(
      ({ onError }: { onError?: () => void }) => ({
        mutate: () => {
          mutateMock();
          onError?.();
        },
      }),
    );

    render(<VoteDetailPage />);
    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "삭제에 실패했습니다.",
          variant: "destructive",
        }),
      );
    });
  });

  it("disables export when no results", () => {
    useQueryMock.mockReturnValueOnce({
      data: [],
      isLoading: false,
    });

    render(<VoteDetailPage />);
    expect(
      screen.getByRole("button", { name: "결과 내보내기" }),
    ).toBeDisabled();
    expect(screen.getByText("등록된 후보자가 없습니다.")).toBeInTheDocument();
  });

  it("hides candidate registration and shows ended status for past month", () => {
    currentMonthParam = "2000-01";
    render(<VoteDetailPage />);

    expect(screen.getByText("종료")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "후보 등록" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to plain name when masked name is missing", () => {
    useQueryMock.mockReturnValueOnce({
      data: [
        {
          candidateId: "c2",
          voteCount: 1,
          rank: 1,
          user: {
            id: "u2",
            nameMasked: null,
            name: "실명사용자",
            companyName: "테스트건설",
            tradeType: null,
          },
        },
      ],
      isLoading: false,
    });

    render(<VoteDetailPage />);
    expect(screen.getByText("실명사용자")).toBeInTheDocument();
    expect(screen.getByText("테스트건설")).toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("executes queryFn and mutationFn with expected api endpoints", async () => {
    useQueryMock.mockImplementationOnce(
      ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
        void queryFn();
        return { data: baseResults, isLoading: false };
      },
    );

    useMutationMock.mockImplementationOnce(
      ({
        mutationFn,
        onSuccess,
      }: {
        mutationFn: (candidateId: string) => Promise<void>;
        onSuccess?: () => void;
      }) => ({
        mutate: async (candidateId: string) => {
          await mutationFn(candidateId);
          mutateMock();
          onSuccess?.();
        },
      }),
    );

    mockApiFetch
      .mockResolvedValueOnce(baseResults)
      .mockResolvedValueOnce(undefined);

    render(<VoteDetailPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/admin/votes/results?siteId=site-1&month=2099-12",
      );
    });

    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/admin/votes/candidates/c1", {
        method: "DELETE",
      });
    });
  });
});
