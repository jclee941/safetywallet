import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";
import { useSite, useUpdateSite } from "@/hooks/use-api";

const mutateAsyncMock = vi.fn();

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (s: { currentSiteId: string | null }) => unknown) =>
    selector({ currentSiteId: "site-1" }),
}));

vi.mock("@/hooks/use-api", () => ({
  useSite: vi.fn(),
  useUpdateSite: vi.fn(),
}));

const mockUseSite = vi.mocked(useSite);
const mockUseUpdateSite = vi.mocked(useUpdateSite);

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSite.mockReturnValue({
      data: { id: "site-1", name: "현장 A", active: true },
      isLoading: false,
      error: null,
    } as never);

    mockUseUpdateSite.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as never);
  });

  it("shows spinner state while loading", () => {
    mockUseSite.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    render(<SettingsPage />);
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
  });

  it("shows fallback message when site cannot be loaded", () => {
    mockUseSite.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    } as never);

    render(<SettingsPage />);
    expect(
      screen.getByText("현장 정보를 불러올 수 없습니다."),
    ).toBeInTheDocument();
  });

  it("renders form, marks dirty, and saves updated settings", async () => {
    mutateAsyncMock.mockResolvedValue({ ok: true });

    render(<SettingsPage />);

    const saveButton = screen.getByRole("button", { name: "저장" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("현장 이름을 입력하세요"), {
      target: { value: "현장 B" },
    });

    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        siteId: "site-1",
        data: { name: "현장 B", active: true },
      });
    });
  });

  it("reflects success and error banners from mutation state", () => {
    mockUseUpdateSite.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isSuccess: true,
      isError: true,
    } as never);

    render(<SettingsPage />);

    expect(screen.getByText("설정이 저장되었습니다.")).toBeInTheDocument();
    expect(screen.getByText("설정 저장에 실패했습니다.")).toBeInTheDocument();
  });

  it("marks dirty when active checkbox changes", async () => {
    mutateAsyncMock.mockResolvedValue({ ok: true });
    render(<SettingsPage />);

    const saveButton = screen.getByRole("button", { name: "저장" });
    const activeCheckbox = screen.getByRole("checkbox");

    expect(saveButton).toBeDisabled();
    fireEvent.click(activeCheckbox);
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        siteId: "site-1",
        data: { name: "현장 A", active: false },
      });
    });
  });
});
