import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@safetywallet/types";
import LoginPage from "../page";
import { createWrapper } from "@/hooks/__tests__/test-utils";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const {
  pushMock,
  replaceMock,
  loginMock,
  logoutMock,
  setSiteIdMock,
  mockApiFetch,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  loginMock: vi.fn(),
  logoutMock: vi.fn(),
  setSiteIdMock: vi.fn(),
  mockApiFetch: vi.fn(),
}));

type AuthState = {
  login: typeof loginMock;
  logout: typeof logoutMock;
  setSiteId: typeof setSiteIdMock;
  user: { id: string } | null;
  isAdmin: boolean;
  _hasHydrated: boolean;
};

let authState: AuthState;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = vi.mocked(useAuthStore);

describe("LoginPage (__tests__)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = {
      login: loginMock,
      logout: logoutMock,
      setSiteId: setSiteIdMock,
      user: null,
      isAdmin: false,
      _hasHydrated: true,
    };
    mockUseAuthStore.mockImplementation((selector) =>
      selector({
        ...authState,
        tokens: null,
        currentSiteId: null,
        setTokens: vi.fn(),
      } as Parameters<typeof selector>[0]),
    );
  });

  it("returns null site id when memberships and sites are empty", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        user: {
          id: "admin-1",
          phone: "010",
          nameMasked: "관*자",
          role: UserRole.SITE_ADMIN,
        },
        tokens: { accessToken: "acc", refreshToken: "ref" },
      })
      .mockResolvedValueOnce({ memberships: [] })
      .mockResolvedValueOnce([]);

    const { wrapper } = createWrapper();
    render(<LoginPage />, { wrapper });

    fireEvent.change(screen.getByLabelText("아이디"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalled();
      expect(setSiteIdMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows default-site initialization error when lookup throws", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        user: {
          id: "admin-2",
          phone: "010",
          nameMasked: "관*자",
          role: UserRole.SUPER_ADMIN,
        },
        tokens: { accessToken: "acc2", refreshToken: "ref2" },
      })
      .mockRejectedValueOnce(new Error("membership lookup failed"));

    const { wrapper } = createWrapper();
    render(<LoginPage />, { wrapper });

    fireEvent.change(screen.getByLabelText("아이디"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "현장 정보 초기화에 실패했습니다. 대시보드에서 다시 시도해주세요.",
        ),
      ).toBeInTheDocument();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows generic ApiError message for non-rate-limit and non-401 cases", async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError("server down", 500));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("아이디"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows generic fallback message for non-ApiError failures", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("network broke"));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("아이디"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("prevents native form submit default behavior", () => {
    render(<LoginPage />);

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
