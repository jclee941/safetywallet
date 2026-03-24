import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineQueueIndicator } from "@/components/offline-queue-indicator";
import {
  flushOfflineQueue,
  getOfflineQueueLength,
  getBlockedItems,
  retryBlockedItem,
  dismissBlockedItem,
} from "@/lib/api";
import type { OfflineQueueEntry } from "@/lib/offline-queue";

vi.mock("@/lib/api", () => ({
  flushOfflineQueue: vi.fn(),
  getOfflineQueueLength: vi.fn(),
  getBlockedItems: vi.fn(),
  retryBlockedItem: vi.fn(),
  dismissBlockedItem: vi.fn(),
}));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));

const blockedItem: OfflineQueueEntry = {
  id: "blocked-1",
  type: "createPost",
  endpoint: "/posts",
  method: "POST",
  headers: {},
  blobIds: [],
  clientMutationId: "test-uuid",
  createdAt: "2026-03-17T00:00:00.000Z",
  retryCount: 5,
  maxRetries: 5,
  status: "blocked",
  lastError: "409 Conflict: duplicate post",
};

describe("OfflineQueueIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(flushOfflineQueue).mockResolvedValue({
      succeeded: 0,
      failed: 0,
      blocked: 0,
    });
    vi.mocked(getOfflineQueueLength).mockResolvedValue(0);
    vi.mocked(getBlockedItems).mockResolvedValue([]);
    vi.mocked(retryBlockedItem).mockResolvedValue(undefined);
    vi.mocked(dismissBlockedItem).mockResolvedValue(undefined);
  });

  it("returns null when queue is empty", async () => {
    vi.mocked(getOfflineQueueLength).mockResolvedValue(0);
    vi.mocked(getBlockedItems).mockResolvedValue([]);
    const { container } = render(<OfflineQueueIndicator />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("shows pending count with sync button", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(getOfflineQueueLength).mockResolvedValue(3);

    render(<OfflineQueueIndicator />);

    expect(
      await screen.findByText("components.offlineQueue.pending"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "components.offlineQueue.syncNow" }),
    ).toBeEnabled();
  });

  it("shows offline disabled button", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(getOfflineQueueLength).mockResolvedValue(2);

    render(<OfflineQueueIndicator />);

    expect(
      await screen.findByText("components.offlineQueue.pending"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "components.offlineQueue.offline" }),
    ).toBeDisabled();
  });

  it("syncs queue when online", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(getOfflineQueueLength).mockResolvedValue(1);

    render(<OfflineQueueIndicator />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "components.offlineQueue.syncNow",
      }),
    );

    await waitFor(() => {
      expect(flushOfflineQueue).toHaveBeenCalled();
    });
  });

  it("shows blocked items section when items are blocked", async () => {
    vi.mocked(getOfflineQueueLength).mockResolvedValue(0);
    vi.mocked(getBlockedItems).mockResolvedValue([blockedItem]);

    render(<OfflineQueueIndicator />);

    expect(
      await screen.findByText("components.offlineQueue.blockedTitle"),
    ).toBeInTheDocument();

    // Click show details
    fireEvent.click(
      screen.getByRole("button", {
        name: "components.offlineQueue.showDetails",
      }),
    );

    expect(screen.getByText("createPost")).toBeInTheDocument();
    expect(
      screen.getByText("409 Conflict: duplicate post"),
    ).toBeInTheDocument();
  });

  it("retries a blocked item", async () => {
    vi.mocked(getOfflineQueueLength).mockResolvedValue(0);
    vi.mocked(getBlockedItems).mockResolvedValue([blockedItem]);

    render(<OfflineQueueIndicator />);

    await screen.findByText("components.offlineQueue.blockedTitle");

    fireEvent.click(
      screen.getByRole("button", {
        name: "components.offlineQueue.showDetails",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "components.offlineQueue.retry",
      }),
    );

    await waitFor(() => {
      expect(retryBlockedItem).toHaveBeenCalledWith("blocked-1");
    });
  });

  it("dismisses a blocked item", async () => {
    vi.mocked(getOfflineQueueLength).mockResolvedValue(0);
    vi.mocked(getBlockedItems).mockResolvedValue([blockedItem]);

    render(<OfflineQueueIndicator />);

    await screen.findByText("components.offlineQueue.blockedTitle");

    fireEvent.click(
      screen.getByRole("button", {
        name: "components.offlineQueue.showDetails",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "components.offlineQueue.dismiss",
      }),
    );

    await waitFor(() => {
      expect(dismissBlockedItem).toHaveBeenCalledWith("blocked-1");
    });
  });

  it("prevents sync action when offline even if button is force-clicked", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(getOfflineQueueLength).mockResolvedValue(2);

    render(<OfflineQueueIndicator />);

    const button = await screen.findByRole("button", {
      name: "components.offlineQueue.offline",
    });
    button.removeAttribute("disabled");
    fireEvent.click(button);

    await waitFor(() => {
      expect(flushOfflineQueue).not.toHaveBeenCalled();
    });
  });

  it("adds blocked section divider when pending and blocked items coexist", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(getOfflineQueueLength).mockResolvedValue(1);
    vi.mocked(getBlockedItems).mockResolvedValue([blockedItem]);

    render(<OfflineQueueIndicator />);

    await screen.findByText("components.offlineQueue.pending");
    const blockedTitle = await screen.findByText(
      "components.offlineQueue.blockedTitle",
    );
    const wrapper = blockedTitle.closest("div.mt-3.border-t.pt-3");
    expect(wrapper).toBeTruthy();
  });
});
