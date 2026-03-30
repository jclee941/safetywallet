import { describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";

const baseUser = {
  id: "user-1",
  phone: "01000000000",
  nameMasked: "김*수",
  role: "WORKER",
};

describe("auth store", () => {
  it("login sets auth state and tokens", () => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentSiteId: null,
      _hasHydrated: true,
    });

    useAuthStore.getState().login(baseUser, "access-1", "refresh-1");
    const state = useAuthStore.getState();

    expect(state.user).toEqual(baseUser);
    expect(state.accessToken).toBe("access-1");
    expect(state.refreshToken).toBe("refresh-1");
    expect(state.isAuthenticated).toBe(true);
  });

  it("setUser and setCurrentSite update state slices", () => {
    useAuthStore.getState().setUser({
      ...baseUser,
      id: "user-2",
      phone: "01099998888",
    });
    useAuthStore.getState().setCurrentSite("site-123");

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("user-2");
    expect(state.currentSiteId).toBe("site-123");
  });

  it("logout clears user, tokens, auth flag, and current site", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    useAuthStore.setState({
      user: baseUser,
      accessToken: "access-2",
      refreshToken: "refresh-2",
      isAuthenticated: true,
      currentSiteId: "site-9",
      _hasHydrated: true,
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(fetchSpy).toHaveBeenCalled();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.currentSiteId).toBeNull();
  });

  it("setTokens updates access and refresh tokens", () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
    });

    useAuthStore.getState().setTokens("new-access", "new-refresh");
    const state = useAuthStore.getState();

    expect(state.accessToken).toBe("new-access");
    expect(state.refreshToken).toBe("new-refresh");
  });

  it("logout without refreshToken does not call fetch", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    useAuthStore.setState({
      user: baseUser,
      accessToken: "access-3",
      refreshToken: null,
      isAuthenticated: true,
      currentSiteId: "site-10",
      _hasHydrated: true,
    });

    useAuthStore.getState().logout();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("logout swallows fetch errors when API call fails", () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    useAuthStore.setState({
      user: baseUser,
      accessToken: "access-err",
      refreshToken: "refresh-err",
      isAuthenticated: true,
      currentSiteId: "site-err",
      _hasHydrated: true,
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("_hasHydrated is set via onFinishHydration", () => {
    useAuthStore.setState({ _hasHydrated: false });
    useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
  });

  it("does not set _hasHydrated immediately when persist.hasHydrated is false", async () => {
    vi.resetModules();

    const setStateSpy = vi.fn();
    let capturedCallback: (() => void) | null = null;
    const onFinishHydrationSpy = vi.fn((cb: () => void) => {
      capturedCallback = cb;
    });
    const hasHydratedSpy = vi.fn(() => false);

    const mockStore = {
      persist: {
        onFinishHydration: onFinishHydrationSpy,
        hasHydrated: hasHydratedSpy,
      },
      setState: setStateSpy,
    };

    vi.doMock("zustand", () => ({
      create: () => () => mockStore,
    }));

    vi.doMock("zustand/middleware", () => ({
      persist: (initializer: unknown) => initializer,
      createJSONStorage: () => vi.fn(),
      devtools: (fn: unknown) => fn,
    }));

    await import("@/stores/auth");

    expect(onFinishHydrationSpy).toHaveBeenCalledTimes(1);
    expect(hasHydratedSpy).toHaveBeenCalledTimes(1);
    expect(setStateSpy).not.toHaveBeenCalled();

    expect(capturedCallback).not.toBeNull();
    capturedCallback!();
    expect(setStateSpy).toHaveBeenCalledWith({ _hasHydrated: true });

    vi.doUnmock("zustand");
    vi.doUnmock("zustand/middleware");
  });

  it("skips hydration setup when window is undefined (SSR)", async () => {
    vi.resetModules();

    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const onFinishHydrationSpy = vi.fn();
    const hasHydratedSpy = vi.fn(() => true);

    const mockStore = {
      persist: {
        onFinishHydration: onFinishHydrationSpy,
        hasHydrated: hasHydratedSpy,
      },
      setState: vi.fn(),
    };

    vi.doMock("zustand", () => ({
      create: () => () => mockStore,
    }));

    vi.doMock("zustand/middleware", () => ({
      persist: (initializer: unknown) => initializer,
      createJSONStorage: () => vi.fn(),
      devtools: (fn: unknown) => fn,
    }));

    await import("@/stores/auth");

    expect(onFinishHydrationSpy).not.toHaveBeenCalled();
    expect(hasHydratedSpy).not.toHaveBeenCalled();

    globalThis.window = originalWindow;
    vi.doUnmock("zustand");
    vi.doUnmock("zustand/middleware");
  });
});
