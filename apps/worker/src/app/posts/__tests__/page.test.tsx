import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostsPage from "@/app/posts/page";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@/components/post-card", () => ({
  PostCard: ({ post }: { post: { id: string } }) => <div>post:{post.id}</div>,
}));

describe("app/posts/page", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: "site-1",
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });
  });

  it("renders loading skeletons", () => {
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never);

    const { container } = render(<PostsPage />);

    expect(
      screen.getByText("posts.pageList.myReportsList"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("renders empty state and filter switching", () => {
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: { pages: [{ data: { items: [] } }] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never);

    render(<PostsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "posts.pageList.urgent" }),
    );
    expect(screen.getByText("posts.pageList.noReportsYet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "posts.pageList.newReport" }),
    ).toHaveAttribute("href", "/posts/new");
  });

  it("renders post list", () => {
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: {
        pages: [{ data: { items: [{ id: "p1" }, { id: "p2" }] } }],
      },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: true,
    } as never);

    render(<PostsPage />);

    expect(screen.getByText("post:p1")).toBeInTheDocument();
    expect(screen.getByText("post:p2")).toBeInTheDocument();
  });

  it("builds query params in queryFn and paginates on intersection", async () => {
    const fetchNextPage = vi.fn();
    let capturedObserver:
      | ((entries: IntersectionObserverEntry[]) => void)
      | undefined;

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
          capturedObserver = cb;
        }

        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );

    vi.mocked(useInfiniteQuery).mockImplementation((options) => {
      const queryFn = options.queryFn as (ctx: {
        pageParam?: string;
      }) => Promise<unknown>;
      void queryFn({ pageParam: "cursor-1" });
      return {
        data: { pages: [{ data: { items: [{ id: "p1" }] } }] },
        isLoading: false,
        fetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
      } as never;
    });
    vi.mocked(apiFetch).mockResolvedValue({
      data: { items: [], nextCursor: "n" },
    } as never);

    render(<PostsPage />);

    expect(apiFetch).toHaveBeenCalledWith(
      "/posts/me?siteId=site-1&cursor=cursor-1&limit=20",
    );

    capturedObserver?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not paginate when observer is not intersecting or already fetching", () => {
    const fetchNextPage = vi.fn();
    let capturedObserver:
      | ((entries: IntersectionObserverEntry[]) => void)
      | undefined;

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
          capturedObserver = cb;
        }

        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );

    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: { pages: [{ data: { items: [{ id: "p1" }] } }] },
      isLoading: false,
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: true,
    } as never);

    render(<PostsPage />);

    capturedObserver?.([
      { isIntersecting: false } as IntersectionObserverEntry,
    ]);
    capturedObserver?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("omits siteId query param when current site is missing", async () => {
    vi.mocked(useAuth).mockReturnValue({
      currentSiteId: null,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    vi.mocked(useInfiniteQuery).mockImplementation((options) => {
      const queryFn = options.queryFn as (ctx: {
        pageParam?: string;
      }) => Promise<unknown>;
      void queryFn({ pageParam: undefined });
      return {
        data: { pages: [{ data: { items: [] } }] },
        isLoading: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      } as never;
    });
    vi.mocked(apiFetch).mockResolvedValue({
      data: { items: [], nextCursor: undefined },
    } as never);

    render(<PostsPage />);

    expect(apiFetch).toHaveBeenCalledWith("/posts/me?limit=20");
  });

  it("returns undefined next page param when nextCursor is absent", () => {
    let nextParam: unknown;

    vi.mocked(useInfiniteQuery).mockImplementation((options) => {
      const getNextPageParam = options.getNextPageParam as (lastPage: {
        data?: { nextCursor?: string };
      }) => string | undefined;
      nextParam = getNextPageParam({ data: {} });
      return {
        data: { pages: [{ data: { items: [] } }] },
        isLoading: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      } as never;
    });

    render(<PostsPage />);

    expect(nextParam).toBeUndefined();
  });

  it("returns undefined next page param when nextCursor is null", () => {
    let nextParam: unknown;

    vi.mocked(useInfiniteQuery).mockImplementation((options) => {
      const getNextPageParam = options.getNextPageParam as (lastPage: {
        data?: { nextCursor?: string | null };
      }) => string | undefined;
      nextParam = getNextPageParam({ data: { nextCursor: null } });
      return {
        data: { pages: [{ data: { items: [] } }] },
        isLoading: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      } as never;
    });

    render(<PostsPage />);

    expect(nextParam).toBeUndefined();
  });
});
