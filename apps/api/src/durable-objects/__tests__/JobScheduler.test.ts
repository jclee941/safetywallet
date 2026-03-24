import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDefinition } from "../../jobs/registry";
import type { Env } from "../../types";

const mockInitFasConfig = vi.fn();
const mockGetJobRegistry = vi.fn();
const mockPersistSyncFailure = vi.fn();
const mockLogInfo = vi.fn();
const mockLogError = vi.fn();

vi.mock("../../lib/fas", () => ({
  initFasConfig: (...a: unknown[]) => mockInitFasConfig(...a),
}));

vi.mock("../../jobs/registry", () => ({
  getJobRegistry: (...a: unknown[]) => mockGetJobRegistry(...a),
}));

vi.mock("../../jobs/helpers", () => ({
  persistSyncFailure: (...a: unknown[]) => mockPersistSyncFailure(...a),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({
    info: (...a: unknown[]) => mockLogInfo(...a),
    error: (...a: unknown[]) => mockLogError(...a),
  }),
}));

type StoredValue = unknown;

function createState(initialAlarm: number | null = null) {
  const storageMap = new Map<string, StoredValue>();
  let alarm = initialAlarm;

  return {
    storage: {
      get: vi.fn(async (key: string) => storageMap.get(key) ?? null),
      put: vi.fn(async (key: string, value: StoredValue) => {
        storageMap.set(key, value);
      }),
      setAlarm: vi.fn(async (ts: number) => {
        alarm = ts;
      }),
      getAlarm: vi.fn(async () => alarm),
    },
    blockConcurrencyWhile: vi.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
    _storage: storageMap,
  };
}

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    ...overrides,
  } as Env;
}

function makeJob(overrides: Partial<JobDefinition> = {}): JobDefinition {
  return {
    name: "job-1",
    fn: vi.fn(async () => undefined),
    intervalMs: 60_000,
    kstHour: null,
    dayOfWeek: null,
    dayOfMonth: null,
    retryAttempts: 1,
    retryBaseDelayMs: 1000,
    ...overrides,
  };
}

describe("durable-objects/JobScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJobRegistry.mockReturnValue([]);
  });

  it("sets initial alarm only when no existing alarm", async () => {
    const { JobScheduler } = await import("../JobScheduler");

    const stateNoAlarm = createState(null);
    new JobScheduler(
      stateNoAlarm as unknown as DurableObjectState,
      createEnv(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stateNoAlarm.storage.setAlarm).toHaveBeenCalledTimes(1);

    const stateWithAlarm = createState(Date.now() + 1000);
    new JobScheduler(
      stateWithAlarm as unknown as DurableObjectState,
      createEnv(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stateWithAlarm.storage.setAlarm).not.toHaveBeenCalled();
    expect(stateNoAlarm.blockConcurrencyWhile).toHaveBeenCalled();
  });

  it("alarm executes due jobs and always schedules next alarm", async () => {
    const dueFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({ name: "due-job", fn: dueFn }),
    ]);
    const { JobScheduler } = await import("../JobScheduler");
    const state = createState();
    const scheduler = new JobScheduler(
      state as unknown as DurableObjectState,
      createEnv(),
    );

    await scheduler.alarm();
    expect(mockInitFasConfig).toHaveBeenCalled();
    expect(dueFn).toHaveBeenCalled();
    expect(state.storage.setAlarm).toHaveBeenCalled();
  });

  it("fetch handles method/payload validation branches", async () => {
    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      createState() as unknown as DurableObjectState,
      createEnv(),
    );

    const methodRes = await scheduler.fetch(
      new Request("https://scheduler", { method: "GET" }),
    );
    expect(methodRes.status).toBe(405);

    const jsonRes = await scheduler.fetch(
      new Request("https://scheduler", { method: "POST", body: "not-json" }),
    );
    expect(jsonRes.status).toBe(400);

    const payloadRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify(null),
      }),
    );
    expect(payloadRes.status).toBe(400);

    const unknownRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "unknown" }),
      }),
    );
    expect(unknownRes.status).toBe(400);
  });

  it("fetch supports list/status/trigger/enable/disable actions", async () => {
    const runJob = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({ name: "job-a", fn: runJob }),
    ]);
    const state = createState();
    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      state as unknown as DurableObjectState,
      createEnv(),
    );

    const listRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      }),
    );
    expect(listRes.status).toBe(200);

    const statusRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "status" }),
      }),
    );
    expect(statusRes.status).toBe(200);

    const triggerRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "trigger", jobName: "job-a" }),
      }),
    );
    expect(triggerRes.status).toBe(200);
    expect(runJob).toHaveBeenCalled();

    const missingTriggerRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "trigger", jobName: "missing" }),
      }),
    );
    expect(missingTriggerRes.status).toBe(404);

    const enableRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "enable", jobName: "job-a" }),
      }),
    );
    expect(enableRes.status).toBe(200);

    const disableRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "disable", jobName: "job-a" }),
      }),
    );
    expect(disableRes.status).toBe(200);

    const missingEnableRes = await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "enable", jobName: "missing" }),
      }),
    );
    expect(missingEnableRes.status).toBe(404);
  });

  it("does not run disabled job and applies KST-window due logic", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const jobFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({
        name: "window-job",
        fn: jobFn,
        intervalMs: 1000,
        kstHour: 9,
        dayOfWeek: 0,
        dayOfMonth: 1,
      }),
    ]);

    const state = createState();
    state._storage.set("job:window-job:enabled", false);
    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      state as unknown as DurableObjectState,
      createEnv(),
    );
    await scheduler.alarm();
    expect(jobFn).not.toHaveBeenCalled();

    state._storage.set("job:window-job:enabled", true);
    await scheduler.alarm();
    expect(jobFn).toHaveBeenCalledTimes(1);

    await scheduler.alarm();
    expect(jobFn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not run job when kstHour does not match", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    // KST = 09:00, job requires kstHour: 10 → mismatch → line 237

    const jobFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({
        name: "hour-mismatch",
        fn: jobFn,
        intervalMs: 1000,
        kstHour: 10,
        dayOfWeek: null,
        dayOfMonth: null,
      }),
    ]);

    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      createState() as unknown as DurableObjectState,
      createEnv(),
    );
    await scheduler.alarm();

    expect(jobFn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not run job when dayOfWeek does not match", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    // KST = 09:00 Sunday (day 0), job requires dayOfWeek: 1 (Mon) → mismatch → line 240

    const jobFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({
        name: "dow-mismatch",
        fn: jobFn,
        intervalMs: 1000,
        kstHour: 9,
        dayOfWeek: 1,
        dayOfMonth: null,
      }),
    ]);

    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      createState() as unknown as DurableObjectState,
      createEnv(),
    );
    await scheduler.alarm();

    expect(jobFn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not run job when dayOfMonth does not match KST date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const jobFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({
        name: "dom-mismatch",
        fn: jobFn,
        intervalMs: 1000,
        kstHour: 9,
        dayOfWeek: 0,
        dayOfMonth: 2,
      }),
    ]);

    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      createState() as unknown as DurableObjectState,
      createEnv(),
    );
    await scheduler.alarm();

    expect(jobFn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not rerun interval-only job before interval elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

    const jobFn = vi.fn(async () => undefined);
    mockGetJobRegistry.mockReturnValue([
      makeJob({
        name: "interval-job",
        fn: jobFn,
        intervalMs: 60_000,
        kstHour: null,
        dayOfWeek: null,
        dayOfMonth: null,
      }),
    ]);

    const state = createState();
    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      state as unknown as DurableObjectState,
      createEnv(),
    );

    await scheduler.alarm();
    expect(jobFn).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-03-01T00:00:30Z"));
    await scheduler.alarm();
    expect(jobFn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("persists sync failure only for fas jobs and error code fallback", async () => {
    const fasError = Object.assign(new Error("fas failed"), {
      code: "FAS_DOWN",
    });
    const fasJob = makeJob({
      name: "fas-sync",
      fn: vi.fn(async () => {
        throw fasError;
      }),
    });
    const normalJob = makeJob({
      name: "normal-job",
      fn: vi.fn(async () => {
        throw new Error("normal failed");
      }),
    });
    mockGetJobRegistry.mockReturnValue([fasJob, normalJob]);

    const { JobScheduler } = await import("../JobScheduler");
    const scheduler = new JobScheduler(
      createState() as unknown as DurableObjectState,
      createEnv(),
    );

    await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "trigger", jobName: "fas-sync" }),
      }),
    );
    expect(mockPersistSyncFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorCode: "FAS_DOWN",
        lockName: "fas",
      }),
    );

    mockPersistSyncFailure.mockClear();
    await scheduler.fetch(
      new Request("https://scheduler", {
        method: "POST",
        body: JSON.stringify({ action: "trigger", jobName: "normal-job" }),
      }),
    );
    expect(mockPersistSyncFailure).not.toHaveBeenCalled();
  });
});
