import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useSiteInfo, useLeaveSite } from "@/hooks/use-api";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { getMockRouter } from "@/__tests__/mocks";

const { toastMock } = vi.hoisted(() => {
  const toastMock = vi.fn();
  return { toastMock };
});

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-api", () => ({
  useProfile: vi.fn(),
  useSiteInfo: vi.fn(),
  useLeaveSite: vi.fn(),
}));
vi.mock("@/hooks/use-push-subscription", () => ({
  usePushSubscription: vi.fn(),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/header", () => ({ Header: () => <div>header</div> }));
vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <div>bottom-nav</div>,
}));
vi.mock("@safetywallet/ui", async () => {
  const actual = await vi.importActual("@safetywallet/ui");
  return {
    ...actual,
    toast: toastMock,
    AlertDialog: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
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
    AlertDialogCancel: ({ children }: { children: ReactNode }) => (
      <button type="button">{children}</button>
    ),
    AlertDialogAction: ({
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
  };
});

describe("app/profile/page", () => {
  const logout = vi.fn();
  const setCurrentSite = vi.fn();
  const replaceSpy = vi
    .spyOn(window.location, "replace")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      logout,
      currentSiteId: "site-1",
      setCurrentSite,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
    });
    vi.mocked(useProfile).mockReturnValue({
      data: { data: { user: { nameMasked: "홍*동", phone: "010-1111-2222" } } },
      isLoading: false,
    } as never);
    vi.mocked(useSiteInfo).mockReturnValue({
      data: { data: { site: { name: "송도현장", address: "인천" } } },
    } as never);
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: true,
      isSubscribed: false,
      isLoading: false,
      error: "",
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders profile and site info", () => {
    render(<ProfilePage />);
    expect(screen.getByText("홍*동")).toBeInTheDocument();
    expect(screen.getByText("송도현장")).toBeInTheDocument();
  });

  it("handles logout action", () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: /profile\.logout/ }));
    expect(logout).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith("/login/");
  });

  it("handles leave-site success", async () => {
    const mutate = vi.fn(
      (_payload: unknown, options: { onSuccess: () => void }) =>
        options.onSuccess(),
    );
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    render(<ProfilePage />);

    const leaveButtons = screen.getAllByRole("button", {
      name: /profile\.leaveSiteButton/,
    });
    fireEvent.click(leaveButtons[0]);
    fireEvent.click(leaveButtons[1]);

    await waitFor(() => {
      expect(setCurrentSite).toHaveBeenCalledWith(null);
      expect(getMockRouter().replace).toHaveBeenCalledWith("/home");
    });
  });

  it("toggles push subscription on and off", async () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: true,
      isSubscribed: false,
      isLoading: false,
      error: "",
      subscribe,
      unsubscribe,
    });

    const { rerender } = render(<ProfilePage />);

    const pushSwitch = screen.getByRole("switch", {
      name: "profile.pushAriaLabel",
    });
    fireEvent.click(pushSwitch);
    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });

    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: true,
      isSubscribed: true,
      isLoading: false,
      error: "",
      subscribe,
      unsubscribe,
    });

    rerender(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("switch", { name: "profile.pushAriaLabel" }),
    );
    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  it("shows leave-site error toast on mutation failure", async () => {
    const mutate = vi.fn(
      (_payload: unknown, options: { onError: () => void }) =>
        options.onError(),
    );
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    render(<ProfilePage />);

    const leaveButtons = screen.getAllByRole("button", {
      name: /profile\.leaveSiteButton/,
    });
    fireEvent.click(leaveButtons[0]);
    fireEvent.click(leaveButtons[1]);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "common.error",
          description: "profile.leaveFailed",
          variant: "destructive",
        }),
      );
    });
  });

  it("renders loading skeletons while profile is loading", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    const { container } = render(<ProfilePage />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("shows name and site fallbacks when data is missing", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: { data: { user: {} } },
      isLoading: false,
    } as never);
    vi.mocked(useSiteInfo).mockReturnValue({
      data: { data: { site: null } },
    } as never);

    render(<ProfilePage />);

    expect(screen.getByText("profile.noName")).toBeInTheDocument();
    expect(screen.getByText("👷")).toBeInTheDocument();
    expect(screen.getByText("profile.loading")).toBeInTheDocument();
  });

  it("renders company and trade information when provided", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: {
        data: {
          user: {
            nameMasked: "홍*동",
            phone: "010-1111-2222",
            companyName: "미래도시건설",
            tradeType: "배관",
          },
        },
      },
      isLoading: false,
    } as never);

    render(<ProfilePage />);

    expect(screen.getByText("미래도시건설 · 배관")).toBeInTheDocument();
  });

  it("renders company name without separator when trade type is missing", () => {
    vi.mocked(useProfile).mockReturnValue({
      data: {
        data: {
          user: {
            nameMasked: "홍*동",
            companyName: "미래도시건설",
          },
        },
      },
      isLoading: false,
    } as never);

    render(<ProfilePage />);

    expect(screen.getByText("미래도시건설")).toBeInTheDocument();
    expect(screen.queryByText(/미래도시건설 ·/)).not.toBeInTheDocument();
  });

  it("disables leave-site action when user has no current site", () => {
    const mutate = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      logout,
      currentSiteId: null,
      setCurrentSite,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
    });
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    render(<ProfilePage />);

    const leaveButton = screen.getAllByRole("button", {
      name: /profile\.leaveSiteButton/,
    })[0];
    expect(leaveButton).toBeDisabled();
    fireEvent.click(leaveButton);
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("profile.currentSite")).not.toBeInTheDocument();
  });

  it("shows push unsupported message and disables switch", () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: false,
      isSubscribed: false,
      isLoading: false,
      error: "",
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    });

    render(<ProfilePage />);

    expect(screen.getByText("profile.pushNotSupported")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "profile.pushAriaLabel" }),
    ).toBeDisabled();
  });

  it("shows push loading/error state and blocks toggle while loading", () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: true,
      isSubscribed: false,
      isLoading: true,
      error: "push failed",
      subscribe,
      unsubscribe: vi.fn(),
    });

    render(<ProfilePage />);

    const pushSwitch = screen.getByRole("switch", {
      name: "profile.pushAriaLabel",
    });
    expect(pushSwitch).toBeDisabled();
    expect(screen.getByText("profile.pushUpdating")).toBeInTheDocument();
    expect(screen.getByText("push failed")).toBeInTheDocument();

    fireEvent.click(pushSwitch);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("returns early in push toggle handler while push state is loading", () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePushSubscription).mockReturnValue({
      isSupported: true,
      isSubscribed: false,
      isLoading: true,
      error: "",
      subscribe,
      unsubscribe: vi.fn(),
    });

    render(<ProfilePage />);

    const pushSwitch = screen.getByRole("switch", {
      name: "profile.pushAriaLabel",
    });
    pushSwitch.removeAttribute("disabled");
    fireEvent.click(pushSwitch);

    expect(subscribe).not.toHaveBeenCalled();
  });

  it("returns early in leave-site handler when no current site id", () => {
    const mutate = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      logout,
      currentSiteId: null,
      setCurrentSite,
      isAuthenticated: true,
      _hasHydrated: true,
      user: null,
      login: vi.fn(),
    });
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    render(<ProfilePage />);

    const leaveButtons = screen.getAllByRole("button", {
      name: /profile\.leaveSiteButton/,
    });
    leaveButtons[1].removeAttribute("disabled");
    fireEvent.click(leaveButtons[1]);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows processing label when leave-site mutation is pending", () => {
    vi.mocked(useLeaveSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as never);

    render(<ProfilePage />);

    expect(
      screen.getByRole("button", { name: "profile.processing" }),
    ).toBeDisabled();
  });
});
