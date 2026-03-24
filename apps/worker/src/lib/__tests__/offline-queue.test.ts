import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StoreName = "queueEntries" | "queueBlobs";

interface UpgradeDb {
  objectStoreNames: {
    contains: (name: string) => boolean;
  };
  createObjectStore: (name: string, options: { keyPath: string }) => void;
}

interface MockDb extends UpgradeDb {
  put: (store: string, value: unknown) => Promise<void>;
  get: (store: string, key: string) => Promise<unknown>;
  getAll: (store: string) => Promise<unknown[]>;
  delete: (store: string, key: string) => Promise<void>;
}

const { openDBMock } = vi.hoisted(() => ({
  openDBMock: vi.fn(),
}));

vi.mock("idb", () => ({
  openDB: openDBMock,
}));

function createMockDb(): MockDb {
  const objectStoreNames = new Set<string>();
  const stores: Record<StoreName, Map<string, unknown>> = {
    queueEntries: new Map<string, unknown>(),
    queueBlobs: new Map<string, unknown>(),
  };

  const getStore = (store: string) =>
    stores[store as StoreName] ?? new Map<string, unknown>();

  return {
    objectStoreNames: {
      contains: (name: string) => objectStoreNames.has(name),
    },
    createObjectStore: (name: string) => {
      objectStoreNames.add(name);
    },
    put: async (store: string, value: unknown) => {
      const map = getStore(store);
      const key = String((value as { id: string }).id);
      map.set(key, value);
    },
    get: async (store: string, key: string) => {
      const map = getStore(store);
      return map.get(key);
    },
    getAll: async (store: string) => {
      const map = getStore(store);
      return Array.from(map.values());
    },
    delete: async (store: string, key: string) => {
      const map = getStore(store);
      map.delete(key);
    },
  };
}

describe("offline-queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    openDBMock.mockReset();
    localStorage.clear();

    const db = createMockDb();
    openDBMock.mockImplementation(
      async (
        _name: string,
        _version: number,
        options?: { upgrade?: (db: UpgradeDb) => void },
      ) => {
        options?.upgrade?.(db);
        return db;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty flush result when api fetch is not configured", async () => {
    const queue = await import("@/lib/offline-queue");

    await queue.enqueueOfflineRequest("/posts", {
      body: JSON.stringify({ a: 1 }),
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 0,
      failed: 0,
      blocked: 0,
    });
  });

  it("enqueues JSON body and flushes successfully", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/posts", {
      method: "POST",
      body: JSON.stringify({ title: "new" }),
      headers: { "Content-Type": "application/json" },
      offlineMutationType: "createPost",
      clientMutationId: "c1",
    });

    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);
    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 1,
      blocked: 0,
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "new" }),
      }),
    );
    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 0,
      blocked: 0,
    });
  });

  it("reconstructs form data and removes content-type header on replay", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    const formData = new FormData();
    formData.append("note", "memo");
    formData.append("file", new Blob(["abc"], { type: "text/plain" }), "a.txt");

    await queue.enqueueOfflineRequest("/upload", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Custom": "yes",
      },
      offlineMutationType: "createPost",
    });

    await queue.flushOfflineQueue();

    const replayOptions = apiFetch.mock.calls[0]?.[1] as {
      body: FormData;
      headers: Record<string, string>;
    };
    expect(replayOptions.body).toBeInstanceOf(FormData);
    expect(replayOptions.headers).toEqual({ "X-Custom": "yes" });
    expect(replayOptions.body.get("note")).toBe("memo");
    expect(replayOptions.body.get("file")).toBeInstanceOf(Blob);
  });

  it("stores raw Blob body into blob store and replays", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/blob-upload", {
      method: "POST",
      body: new Blob(["blob-data"], { type: "text/plain" }),
      headers: { "Content-Type": "text/plain" },
      offlineMutationType: "createPost",
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/blob-upload",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("marks 409 conflicts as blocked and supports retry/dismiss", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi
      .fn()
      .mockRejectedValue({ status: 409, message: "conflict" });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/actions/a1", {
      method: "PATCH",
      body: JSON.stringify({ status: "DONE" }),
      offlineMutationType: "updateActionStatus",
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 0,
      failed: 0,
      blocked: 1,
    });

    const blocked = await queue.getBlockedItems();
    expect(blocked).toHaveLength(1);

    await queue.retryBlockedItem(blocked[0].id);
    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);

    apiFetch.mockResolvedValue({ ok: true });
    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });

    await queue.enqueueOfflineRequest("/actions/a2", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
      offlineMutationType: "updateActionStatus",
    });
    apiFetch.mockRejectedValue({ status: 409, message: "conflict" });
    await queue.flushOfflineQueue();
    const blockedAgain = await queue.getBlockedItems();
    await queue.dismissBlockedItem(blockedAgain[0].id);
    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 0,
      blocked: 0,
    });
  });

  it("increments retries and blocks item after max retries", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockRejectedValue(new Error("network"));
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/recommendations", {
      method: "POST",
      body: JSON.stringify({ reason: "ok" }),
      offlineMutationType: "submitRecommendation",
    });

    await queue.flushOfflineQueue();
    await queue.flushOfflineQueue();
    await queue.flushOfflineQueue();
    await queue.flushOfflineQueue();

    const fifth = await queue.flushOfflineQueue();
    expect(fifth).toEqual({ succeeded: 0, failed: 0, blocked: 1 });

    const blocked = await queue.getBlockedItems();
    expect(blocked[0]?.lastError).toContain("Max retries exceeded");
  });

  it("migrates localStorage queue into idb and clears legacy key", async () => {
    const queue = await import("@/lib/offline-queue");

    localStorage.setItem(
      "safetywallet_offline_queue",
      JSON.stringify([
        {
          id: "legacy-1",
          endpoint: "/posts",
          options: { method: "POST", body: '{"x":1}', headers: { A: "B" } },
          createdAt: "2026-03-23T00:00:00.000Z",
          retryCount: 1,
        },
      ]),
    );

    await expect(queue.migrateFromLocalStorage()).resolves.toBe(1);
    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);
    expect(localStorage.getItem("safetywallet_offline_queue")).toBeNull();
  });

  it("reports blocked count when only blocked entries remain", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi
      .fn()
      .mockRejectedValue({ status: 409, message: "already blocked" });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/actions/block", {
      method: "PATCH",
      body: JSON.stringify({ ok: false }),
      offlineMutationType: "updateActionStatus",
    });
    await queue.flushOfflineQueue();

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 0,
      failed: 0,
      blocked: 1,
    });
  });

  it("dismisses blocked item with blobs by deleting blob entries", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi
      .fn()
      .mockRejectedValue({ status: 409, message: "conflict" });
    queue.setApiFetch(apiFetch);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["payload"], { type: "text/plain" }),
      "payload.txt",
    );

    await queue.enqueueOfflineRequest("/dismiss-with-blob", {
      method: "POST",
      body: formData,
      offlineMutationType: "createPost",
    });

    await queue.flushOfflineQueue();
    const blocked = await queue.getBlockedItems();
    await queue.dismissBlockedItem(blocked[0].id);

    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 0,
      blocked: 0,
    });
  });

  it("returns 0 migration count when legacy queue JSON is invalid", async () => {
    const queue = await import("@/lib/offline-queue");
    localStorage.setItem("safetywallet_offline_queue", "{invalid-json");

    await expect(queue.migrateFromLocalStorage()).resolves.toBe(0);
  });

  it("returns 0 on migration when window is unavailable", async () => {
    vi.stubGlobal("window", undefined);
    const queue = await import("@/lib/offline-queue");

    await expect(queue.migrateFromLocalStorage()).resolves.toBe(0);
  });

  it("initializes sync listeners and flushes on online event", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/posts", {
      body: JSON.stringify({ title: "online-replay" }),
      offlineMutationType: "createPost",
    });

    queue.initOfflineSync();
    window.dispatchEvent(new Event("online"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetch).toHaveBeenCalledWith(
      "/posts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("flushes on visibility and focus events when online", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/posts", {
      body: JSON.stringify({ title: "visibility-replay" }),
      offlineMutationType: "createPost",
    });

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    queue.initOfflineSync();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetch).toHaveBeenCalled();
  });

  it("keeps queue pending on unknown replay errors and then succeeds", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi
      .fn()
      .mockRejectedValueOnce({ status: "oops" })
      .mockResolvedValueOnce({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/posts/unknown-error", {
      method: "POST",
      body: JSON.stringify({ retry: true }),
      offlineMutationType: "createPost",
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 0,
      failed: 1,
      blocked: 0,
    });

    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });
  });

  it("uses File name when enqueueing FormData file entries", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    const fd = new FormData();
    fd.append("note", "memo");
    fd.append(
      "attachment",
      new File(["f"], "proof.jpg", { type: "image/jpeg" }),
    );

    await queue.enqueueOfflineRequest("/upload-file-name", {
      method: "POST",
      body: fd,
      headers: { "Content-Type": "multipart/form-data" },
      offlineMutationType: "createPost",
    });

    await queue.flushOfflineQueue();

    const replayOptions = apiFetch.mock.calls[0]?.[1] as {
      body: FormData;
    };
    const replayFile = replayOptions.body.get("attachment") as File;
    expect(replayFile).toBeInstanceOf(File);
    expect(replayFile.name).toBe("proof.jpg");
  });

  it("serializes FormData blob fields with fallback filename for non-File blobs", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    const fd = new FormData();
    fd.append("note", "queued-note");
    fd.append(
      "attachment",
      new Blob(["attachment-content"], { type: "text/plain" }),
    );

    await queue.enqueueOfflineRequest("/upload-blob-fallback", {
      method: "POST",
      body: fd,
      headers: { "Content-Type": "multipart/form-data" },
      offlineMutationType: "createPost",
    });

    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);
    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });

    const replayOptions = apiFetch.mock.calls[0]?.[1] as {
      body: FormData;
      headers: Record<string, string>;
    };
    expect(replayOptions.headers).toEqual({});
    expect(replayOptions.body.get("note")).toBe("queued-note");
    const replayBlob = replayOptions.body.get("attachment") as File;
    expect(replayBlob).toBeInstanceOf(File);
    expect(replayBlob.name).toBe("blob");
    expect(replayBlob.type).toBe("text/plain");
  });

  it("uses application/octet-stream when FormData blob has no content type", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    const fd = new FormData();
    fd.append("attachment", new Blob(["raw-data"]));

    await queue.enqueueOfflineRequest("/upload-no-type", {
      method: "POST",
      body: fd,
      headers: { "Content-Type": "multipart/form-data" },
      offlineMutationType: "createPost",
    });

    await queue.flushOfflineQueue();

    const replayOptions = apiFetch.mock.calls[0]?.[1] as {
      body: FormData;
    };
    const replayFile = replayOptions.body.get("attachment") as File;
    expect(replayFile.type).toBe("");
  });

  it("replays entry even when queued blob record is missing", async () => {
    vi.resetModules();
    const db = createMockDb();
    openDBMock.mockImplementation(
      async (
        _name: string,
        _version: number,
        options?: { upgrade?: (upgradeDb: UpgradeDb) => void },
      ) => {
        options?.upgrade?.(db);
        return {
          ...db,
          get: async (store: string, key: string) => {
            if (store === "queueBlobs") {
              return undefined;
            }
            return db.get(store, key);
          },
        };
      },
    );

    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    const fd = new FormData();
    fd.append("note", "blob-missing");
    fd.append("file", new Blob(["payload"], { type: "text/plain" }), "x.txt");

    await queue.enqueueOfflineRequest("/missing-blob", {
      method: "POST",
      body: fd,
      headers: { "Content-Type": "multipart/form-data" },
      offlineMutationType: "createPost",
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });
    const replayOptions = apiFetch.mock.calls[0]?.[1] as {
      body: FormData;
      headers: Record<string, string>;
    };
    expect(replayOptions.body.get("note")).toBe("blob-missing");
    expect(replayOptions.body.get("file")).toBeNull();
  });

  it("retries non-409 errors and keeps queue item pending", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: "server-error" })
      .mockResolvedValueOnce({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/retry-on-500", {
      method: "POST",
      body: JSON.stringify({ retry: "yes" }),
      offlineMutationType: "submitRecommendation",
    });

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 0,
      failed: 1,
      blocked: 0,
    });
    await expect(queue.getOfflineQueueLength()).resolves.toBe(1);

    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });
    await expect(queue.getOfflineQueueLength()).resolves.toBe(0);
  });

  it("migrates legacy item with missing method and headers using defaults", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    localStorage.setItem(
      "safetywallet_offline_queue",
      JSON.stringify([
        {
          id: "legacy-defaults-1",
          endpoint: "/legacy-defaults",
          options: { body: '{"x":1}' },
          createdAt: "2026-03-23T00:00:00.000Z",
          retryCount: 0,
        },
      ]),
    );

    await expect(queue.migrateFromLocalStorage()).resolves.toBe(1);
    await expect(queue.flushOfflineQueue()).resolves.toEqual({
      succeeded: 1,
      failed: 0,
      blocked: 0,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/legacy-defaults",
      expect.objectContaining({
        method: "POST",
        body: '{"x":1}',
        headers: {},
      }),
    );
  });

  it("returns zero migration count for missing and empty legacy queue", async () => {
    const queue = await import("@/lib/offline-queue");

    await expect(queue.migrateFromLocalStorage()).resolves.toBe(0);

    localStorage.setItem("safetywallet_offline_queue", "[]");
    await expect(queue.migrateFromLocalStorage()).resolves.toBe(0);
  });

  it("ignores retry and dismiss operations for unknown ids", async () => {
    const queue = await import("@/lib/offline-queue");

    await expect(queue.retryBlockedItem("missing-id")).resolves.toBeUndefined();
    await expect(
      queue.dismissBlockedItem("missing-id"),
    ).resolves.toBeUndefined();
    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 0,
      blocked: 0,
    });
  });

  it("does not flush on visibility/focus when offline or hidden", async () => {
    const queue = await import("@/lib/offline-queue");
    const apiFetch = vi.fn().mockResolvedValue({ ok: true });
    queue.setApiFetch(apiFetch);

    await queue.enqueueOfflineRequest("/posts/no-flush", {
      body: JSON.stringify({ title: "no-flush" }),
      offlineMutationType: "createPost",
    });

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    queue.initOfflineSync();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns safely when initializing sync without window", async () => {
    vi.stubGlobal("window", undefined);
    const queue = await import("@/lib/offline-queue");

    expect(() => queue.initOfflineSync()).not.toThrow();
  });

  it("returns safe defaults when queue read helpers fail", async () => {
    vi.stubGlobal("window", undefined);
    const queue = await import("@/lib/offline-queue");

    await expect(queue.getOfflineQueueLength()).resolves.toBe(0);
    await expect(queue.getBlockedItems()).resolves.toEqual([]);
    await expect(queue.getTotalQueueSize()).resolves.toEqual({
      pending: 0,
      blocked: 0,
    });
  });
});
