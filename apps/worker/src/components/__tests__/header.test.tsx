import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/use-auth";
import { useAttendanceToday } from "@/hooks/use-api";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-api", () => ({
  useAttendanceToday: vi.fn(() => ({ data: null, isLoading: false })),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/locale-switcher", () => ({
  LocaleSwitcher: () => <div>locale-switcher</div>,
}));
vi.mock("@/components/system-banner", () => ({
  SystemBanner: () => null,
}));

const mockUseAttendanceToday = vi.mocked(useAttendanceToday);

describe("Header", () => {
  beforeEach(() => {
    mockUseAttendanceToday.mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useAttendanceToday>);
  });

  it("shows app title and locale switcher", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: null,
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByText("components.appTitle")).toBeInTheDocument();
    expect(screen.getByText("locale-switcher")).toBeInTheDocument();
  });

  it("shows attended badge when attendance data has attended=true", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: "site-123",
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    mockUseAttendanceToday.mockReturnValue({
      data: { attended: true, checkinAt: "2026-02-27T08:30:00Z" },
      isLoading: false,
    } as unknown as ReturnType<typeof useAttendanceToday>);

    render(<Header />);

    expect(screen.getByText(/components\.attended/)).toBeInTheDocument();
  });

  it("shows not-attended badge when attendance data has attended=false", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: "site-123",
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    mockUseAttendanceToday.mockReturnValue({
      data: { attended: false, checkinAt: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAttendanceToday>);

    render(<Header />);

    expect(screen.getByText("components.notAttended")).toBeInTheDocument();
  });

  it("handles attended state with null checkinAt", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: "site-123",
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    mockUseAttendanceToday.mockReturnValue({
      data: { attended: true, checkinAt: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAttendanceToday>);

    render(<Header />);

    expect(screen.getByText(/components\.attended/)).toBeInTheDocument();
  });

  it("does not show badge before hydration", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      currentSiteId: null,
      _hasHydrated: false,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<Header />);

    expect(screen.queryByText("components.attended")).not.toBeInTheDocument();
    expect(
      screen.queryByText("components.notAttended"),
    ).not.toBeInTheDocument();
  });
});
