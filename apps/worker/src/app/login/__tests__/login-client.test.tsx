import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginClient from "@/app/login/login-client";
import { useAuth } from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));

describe("app/login/login-client", () => {
  const login = vi.fn();
  const setCurrentSite = vi.fn();
  const replaceSpy = vi
    .spyOn(window.location, "replace")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      login,
      setCurrentSite,
      isAuthenticated: false,
      _hasHydrated: true,
      currentSiteId: null,
      logout: vi.fn(),
      user: null,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  const fillValidForm = () => {
    fireEvent.change(screen.getByLabelText("auth.phoneNumber"), {
      target: { value: "01012345678" },
    });
    fireEvent.change(screen.getByLabelText("auth.name"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("auth.dateOfBirth"), {
      target: { value: "900101" },
    });
  };

  it("redirects when already authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      login,
      setCurrentSite,
      isAuthenticated: true,
      _hasHydrated: true,
      currentSiteId: "s1",
      logout: vi.fn(),
      user: null,
    });

    render(<LoginClient />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith("/home/");
    });
  });

  it("does not redirect when hydration is not finished", () => {
    vi.mocked(useAuth).mockReturnValue({
      login,
      setCurrentSite,
      isAuthenticated: true,
      _hasHydrated: false,
      currentSiteId: "s1",
      logout: vi.fn(),
      user: null,
    });

    render(<LoginClient />);

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("disables submit until form is valid", () => {
    render(<LoginClient />);

    const button = screen.getByRole("button", { name: "auth.login" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("auth.phoneNumber"), {
      target: { value: "01012345678" },
    });
    fireEvent.change(screen.getByLabelText("auth.name"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("auth.dateOfBirth"), {
      target: { value: "900101" },
    });

    expect(button).toBeEnabled();
  });

  it("logs in and sets site on successful request", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { id: "u1", name: "홍길동" },
            accessToken: "at",
            refreshToken: "rt",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { siteId: "site-1" } }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
      expect(setCurrentSite).toHaveBeenCalledWith("site-1");
      expect(replaceSpy).toHaveBeenCalledWith("/home/");
    });
  });

  it("shows parsed error message on failed login", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: { code: "USER_NOT_FOUND" } }),
    } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(
        screen.getByText("auth.error.accountNotFound"),
      ).toBeInTheDocument();
    });
  });

  it("falls back to generic login error for non-json failure", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => "plain-error",
    } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(screen.getByText("auth.success.loginFailed")).toBeInTheDocument();
    });
  });

  it("sets current site to null when /auth/me fetch fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { id: "u1", name: "홍길동" },
            accessToken: "at",
            refreshToken: "rt",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ data: {} }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(setCurrentSite).toHaveBeenCalledWith(null);
      expect(replaceSpy).toHaveBeenCalledWith("/home/");
    });
  });

  it("accepts hyphenated phone and dob formats after normalization", () => {
    render(<LoginClient />);

    const button = screen.getByRole("button", { name: "auth.login" });
    fireEvent.change(screen.getByLabelText("auth.phoneNumber"), {
      target: { value: "010-1234-5678" },
    });
    fireEvent.change(screen.getByLabelText("auth.name"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("auth.dateOfBirth"), {
      target: { value: "90-01-01" },
    });

    expect(button).toBeEnabled();
  });

  it("keeps current site unchanged when /auth/me has no siteId", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { id: "u1", name: "홍길동" },
            accessToken: "at",
            refreshToken: "rt",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalled();
      expect(replaceSpy).toHaveBeenCalledWith("/home/");
    });
    expect(setCurrentSite).not.toHaveBeenCalled();
  });

  it("shows api-provided error message when code mapping is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () =>
        JSON.stringify({
          error: { code: "UNMAPPED_CODE", message: "Server said no" },
        }),
    } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(screen.getByText("Server said no")).toBeInTheDocument();
    });
  });

  it("maps known account lock and rate limit error codes", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: { code: "ACCOUNT_LOCKED" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED" } }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(screen.getByText("auth.error.accountLocked")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(
        screen.getByText("auth.error.tooManyAttempts"),
      ).toBeInTheDocument();
    });
  });

  it("maps attendance verification error and handles non-Error rejection", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({ error: { code: "ATTENDANCE_NOT_VERIFIED" } }),
      } as Response)
      .mockRejectedValueOnce("network-fail");

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(screen.getByText("auth.error.accountLocked")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(screen.getByText("auth.success.loginFailed")).toBeInTheDocument();
    });
  });

  it("shows locked message when api returns legacy accountLocked error string", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: "accountLocked" }),
    } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(screen.getByText("auth.error.accountLocked")).toBeInTheDocument();
    });
  });

  it("shows retry limit message when api returns legacy tooManyAttempts error string", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: "tooManyAttempts" }),
    } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(
        screen.getByText("auth.error.tooManyAttempts"),
      ).toBeInTheDocument();
    });
  });

  it("maps NAME_MISMATCH and falls back to default for unexpected mapped keys", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: { code: "NAME_MISMATCH" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: { code: "toString" } }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(
        screen.getByText("auth.error.invalidCredentials"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(screen.getByText("auth.success.loginFailed")).toBeInTheDocument();
    });
  });

  it("shows loading state while login request is pending", async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveLogin: ((value: Response) => void) | undefined;
    const loginPromise = new Promise<Response>((resolve) => {
      resolveLogin = resolve;
    });
    fetchMock.mockReturnValueOnce(loginPromise);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));

    expect(
      screen.getByRole("button", { name: "auth.success.loggingIn" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("auth.name")).toBeDisabled();
    expect(screen.getByLabelText("auth.dateOfBirth")).toBeDisabled();
    expect(screen.getByLabelText("auth.phoneNumber")).toBeDisabled();

    resolveLogin?.({
      ok: true,
      json: async () => ({
        data: {
          user: { id: "u1", name: "홍길동" },
          accessToken: "at",
          refreshToken: "rt",
        },
      }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { siteId: "site-1" } }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.login" })).toBeEnabled();
    });
  });

  it("maps string error code and falls back on prototype-mapped switch default", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: "NAME_MISMATCH" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: { code: "toString" } }),
      } as Response);

    render(<LoginClient />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(
        screen.getByText("auth.error.invalidCredentials"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.login" }));
    await waitFor(() => {
      expect(screen.getByText("auth.success.loginFailed")).toBeInTheDocument();
    });
  });
});
