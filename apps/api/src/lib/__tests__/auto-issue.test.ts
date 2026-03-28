import { describe, expect, it, vi, beforeEach } from "vitest";
import { createErrorIssue } from "../auto-issue";
import { createMockKV } from "../../__tests__/helpers";

function mockKV() {
  return createMockKV() as unknown as KVNamespace;
}

const GITLAB_TOKEN = "glpat_test_token";

function makeOpts(overrides?: Partial<Parameters<typeof createErrorIssue>[0]>) {
  return {
    error: new Error("Something broke"),
    endpoint: "/api/posts",
    method: "POST",
    gitlabToken: GITLAB_TOKEN,
    kv: mockKV(),
    ...overrides,
  };
}

describe("createErrorIssue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates a GitLab issue on first occurrence", async () => {
    const mockResponse = { ok: true, json: async () => ({ iid: 42 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const opts = makeOpts();
    await createErrorIssue(opts);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/projects/qws941%2Fsafetywallet/issues");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.title).toContain("[Auto]");
    expect(body.title).toContain("POST /api/posts");
    expect(body.title).toContain("Something broke");
    expect(body.labels).toEqual("type:bug,auto-reported");

    expect(init.headers.Authorization).toBe(`Bearer ${GITLAB_TOKEN}`);
  });

  it("stores fingerprint in KV after successful creation", async () => {
    const mockResponse = { ok: true, json: async () => ({ iid: 99 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const kv = mockKV();
    await createErrorIssue(makeOpts({ kv }));

    expect(kv.put).toHaveBeenCalledOnce();
    const [key, value] = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toMatch(/^auto-issue:/);
    expect(value).toBe("99");
  });

  it("skips issue creation when fingerprint exists in KV (dedup)", async () => {
    const kv = mockKV();
    // Pre-populate dedup key — simulate a recent report
    const opts = makeOpts({ kv });
    // First call to seed the fingerprint
    const mockResponse = { ok: true, json: async () => ({ iid: 10 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
    await createErrorIssue(opts);

    expect(fetch).toHaveBeenCalledOnce();

    // Second call with same error + endpoint should be skipped
    await createErrorIssue(opts);
    expect(fetch).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it("does not store fingerprint when GitLab API fails", async () => {
    const mockResponse = { ok: false, status: 422 };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const kv = mockKV();
    await createErrorIssue(makeOpts({ kv }));

    expect(fetch).toHaveBeenCalledOnce();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("includes stack trace in issue body", async () => {
    const err = new Error("DB connection lost");
    err.stack =
      "Error: DB connection lost\n    at query (db.ts:42)\n    at handler (routes.ts:10)";
    const mockResponse = { ok: true, json: async () => ({ iid: 1 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await createErrorIssue(makeOpts({ error: err }));

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.body).toContain("db.ts:42");
    expect(body.body).toContain("routes.ts:10");
  });

  it("uses fallback stack text when stack is missing", async () => {
    const err = new Error("No stack case");
    Object.defineProperty(err, "stack", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const mockResponse = { ok: true, json: async () => ({ iid: 7 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await createErrorIssue(makeOpts({ error: err }));

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.body).toContain("(no stack)");
  });

  it("different endpoints produce different fingerprints", async () => {
    const mockResponse = { ok: true, json: async () => ({ iid: 1 }) };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const kv = mockKV();
    const err = new Error("timeout");

    await createErrorIssue(
      makeOpts({ kv, error: err, endpoint: "/api/posts" }),
    );
    await createErrorIssue(
      makeOpts({ kv, error: err, endpoint: "/api/users" }),
    );

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
