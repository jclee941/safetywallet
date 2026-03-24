import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManualSyncCard } from "../manual-sync-card";
import { useHyperdriveSync } from "@/hooks/use-fas-sync";

const { toastMock, mutateMock } = vi.hoisted(() => {
  const toastMock = vi.fn();
  const mutateMock = vi.fn();
  return { toastMock, mutateMock };
});

vi.mock("@/hooks/use-fas-sync", () => ({
  useHyperdriveSync: vi.fn(),
}));

vi.mock("@safetywallet/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  toast: toastMock,
}));

const mockUseHyperdriveSync = vi.mocked(useHyperdriveSync);

const toHyperdriveResult = (
  value: unknown,
): ReturnType<typeof useHyperdriveSync> => value as never;

describe("ManualSyncCard", () => {
  beforeEach(() => {
    toastMock.mockReset();
    mutateMock.mockReset();
  });

  it("shows pending state and disables button", () => {
    mockUseHyperdriveSync.mockReturnValue(
      toHyperdriveResult({ isPending: true, mutate: mutateMock }),
    );

    render(<ManualSyncCard />);

    expect(screen.getByRole("button", { name: "동기화 중..." })).toBeDisabled();
  });

  it("runs manual sync and handles success toast", () => {
    mutateMock.mockImplementation(
      (
        _vars,
        options: {
          onSuccess?: (data: {
            sync: { created: number; updated: number };
            deactivated: number;
          }) => void;
        },
      ) => {
        options.onSuccess?.({
          sync: { created: 2, updated: 3 },
          deactivated: 1,
        });
      },
    );
    mockUseHyperdriveSync.mockReturnValue(
      toHyperdriveResult({ isPending: false, mutate: mutateMock }),
    );

    render(<ManualSyncCard />);
    fireEvent.click(screen.getByRole("button", { name: "Hyperdrive 동기화" }));

    expect(mutateMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Hyperdrive 동기화 완료: 2건 생성, 3건 갱신, 1건 비활성화",
      }),
    );
  });

  it("shows error toast when manual sync fails", () => {
    mutateMock.mockImplementation(
      (_vars, options: { onError?: () => void }) => {
        options.onError?.();
      },
    );
    mockUseHyperdriveSync.mockReturnValue(
      toHyperdriveResult({ isPending: false, mutate: mutateMock }),
    );

    render(<ManualSyncCard />);
    fireEvent.click(screen.getByRole("button", { name: "Hyperdrive 동기화" }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Hyperdrive 동기화 실패",
      }),
    );
  });
});
