import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

interface AuthContext {
  user: {
    id: string;
    role: string;
    name: string;
    nameMasked: string;
    phone: string;
  };
  loginDate: string;
}

function makeAuth(role = "SITE_ADMIN"): AuthContext {
  return {
    user: {
      id: "admin-1",
      role,
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
    },
    loginDate: "2025-01-01",
  };
}

vi.mock("../helpers", () => ({
  requireAdmin: vi.fn(async (c: any, next: () => Promise<void>) => {
    const auth = c.get("auth") as AuthContext | undefined;
    if (!auth) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Unauthorized",
          },
        },
        401,
      );
    }
    if (auth.user.role !== "SITE_ADMIN" && auth.user.role !== "SUPER_ADMIN") {
      return c.json(
        {
          error: {
            code: "ADMIN_ACCESS_REQUIRED",
            message: "Admin access required",
          },
        },
        403,
      );
    }
    await next();
  }),
}));

vi.mock("../../../lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

async function createApp(
  auth?: AuthContext,
  envOverrides?: Partial<Record<string, unknown>>,
) {
  const { default: route } = await import("../issues");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);

  const env = {
    DB: {},
    GITLAB_TOKEN: "token",
    KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
    },
    ...envOverrides,
  } as Record<string, unknown>;

  return { app, env };
}

describe("admin/issues", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("GET /issues/templates", () => {
    it("returns cached templates from KV", async () => {
      const cached = [{ slug: "task", name: "Task", fields: [] }];
      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => cached),
          put: vi.fn(async () => undefined),
        },
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await app.request("/issues/templates", {}, env);

      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches and parses templates from GitLab when cache is empty", async () => {
      const yml = btoa(
        [
          "<!--",
          "name: Bug report",
          "description: Report a bug",
          "labels:",
          "  - bug",
          "-->",
          "",
          "## Details",
          "<!-- Explain what happened -->",
        ].join("\n"),
      );

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const kvPut = vi.fn(async () => undefined);
      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: kvPut,
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ slug: string; name: string; labels: string[] }>;
      };
      expect(body.data[0].slug).toBe("bug_report");
      expect(body.data[0].name).toBe("Bug report");
      expect(kvPut).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("returns empty templates when one upstream fetch throws", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("continues when KV cache read fails", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));
      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => {
            throw new Error("kv read failed");
          }),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("defaults labels to empty array when YAML has no labels field", async () => {
      const yml = btoa(
        [
          "<!--",
          "name: No Labels Template",
          "description: A template without labels",
          "-->",
          "",
          "## Info",
          "<!-- Provide context -->",
        ].join("\n"),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ slug: string; labels: string[] }>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].labels).toEqual([]);
    });

    it("continues when KV cache write fails", async () => {
      const yml = btoa(
        [
          "<!--",
          "name: Bug report",
          "description: Report a bug",
          "labels:",
          "  - bug",
          "-->",
          "",
          "## Details",
          "<!-- Explain what happened -->",
        ].join("\n"),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => {
            throw new Error("kv write failed");
          }),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ slug: string; name: string }>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe("bug_report");
    });

    it("returns 503 when GITLAB_TOKEN is absent", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const { app, env } = await createApp(makeAuth(), {
        GITLAB_TOKEN: "",
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(503);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("skips templates when GitLab response has no content field", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("skips templates when frontmatter has no name field", async () => {
      const yml = btoa(
        ["<!--", "description: no name", "-->", "", "## X", "<!-- X -->"].join(
          "\n",
        ),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("extracts markdown sections into template fields", async () => {
      const yml = btoa(
        [
          "<!--",
          "name: Mixed",
          "description: mixed types",
          "-->",
          "",
          "## Valid",
          "<!-- Valid input -->",
        ].join("\n"),
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ fields: Array<{ id: string }> }>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].fields).toHaveLength(1);
      expect(body.data[0].fields[0].id).toBe("valid");
    });
  });

  describe("GET /issues", () => {
    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp(undefined);
      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 503 when GITLAB_TOKEN is absent", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { app, env } = await createApp(makeAuth(), { GITLAB_TOKEN: "" });

      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(503);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns upstream error status and message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
      );
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues?state=closed", {}, env);
      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain("Failed to reach GitLab API");
    });

    it("transforms GitLab issues to API response shape", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              iid: 1,
              title: "Issue one",
              description: "details",
              state: "opened",
              labels: ["bug"],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              web_url:
                "http://192.168.50.215:8929/root/safetywallet/-/issues/1",
              author: { id: 7, username: "admin", name: "Admin" },
            },
          ]),
          { status: 200 },
        ),
      );
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues?labels=bug", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ number: number; labels: Array<{ name: string }> }>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].number).toBe(1);
      expect(body.data[0].labels).toEqual([{ name: "bug" }]);
    });

    it("maps non-4xx/5xx upstream status to 502", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("temporary redirect", { status: 302 }),
      );
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(502);
    });

    it("returns 502 when issues upstream fetch throws", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(502);
    });
  });

  describe("POST /issues", () => {
    it("returns 503 when GITLAB_TOKEN is missing", async () => {
      const { app, env } = await createApp(makeAuth(), { GITLAB_TOKEN: "" });
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "test" }),
        },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 400 for invalid JSON", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ bad json",
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when title is blank", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "   " }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 502 when issue creation fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Validation Failed" }), {
          status: 422,
        }),
      );
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "new issue" }),
        },
        env,
      );
      expect(res.status).toBe(502);
    });

    it("creates issue successfully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            iid: 11,
            title: "new issue",
            description: "details",
            state: "opened",
            labels: [],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            web_url: "http://192.168.50.215:8929/root/safetywallet/-/issues/11",
            author: { id: 7, username: "admin", name: "Admin" },
          }),
          { status: 201 },
        ),
      );

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "new issue", body: "details" }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("creates issue and performs codex assignment side effects", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              iid: 12,
              title: "codex issue",
              description: "details",
              state: "opened",
              labels: ["bug", "codex"],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              web_url:
                "http://192.168.50.215:8929/root/safetywallet/-/issues/12",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 1,
              body: "@codex codex issue",
              created_at: "2026-01-01T00:00:00.000Z",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        );

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "codex issue",
            body: "details",
            assignCodex: true,
            labels: ["bug"],
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("still returns 201 when codex follow-up calls fail", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              iid: 13,
              title: "codex issue failure path",
              description: "details",
              state: "opened",
              labels: ["codex"],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              web_url:
                "http://192.168.50.215:8929/root/safetywallet/-/issues/13",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        )
        .mockRejectedValueOnce(new Error("comment down"));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "codex issue failure path",
            body: "details",
            assignCodex: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
    });

    it("builds codex comment with empty string when issue body is null", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              iid: 15,
              title: "no-body issue",
              description: null,
              state: "opened",
              labels: ["codex"],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              web_url:
                "http://192.168.50.215:8929/root/safetywallet/-/issues/15",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 2,
              body: "@codex no-body issue",
              created_at: "2026-01-01T00:00:00.000Z",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        );

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "no-body issue",
            assignCodex: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const commentCall = fetchSpy.mock.calls[1];
      const commentBody = JSON.parse(commentCall[1]?.body as string) as {
        body: string;
      };
      expect(commentBody.body).toContain("@codex no-body issue");
      expect(commentBody.body).not.toContain("null");
    });

    it("returns 502 when issue creation fetch throws", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("network error"),
      );
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "test issue", body: "details" }),
        },
        env,
      );
      expect(res.status).toBe(502);
    });

    it("still returns 201 when codex assignment catch receives non-Error", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              iid: 14,
              title: "codex non-error",
              description: "details",
              state: "opened",
              labels: ["codex"],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              web_url:
                "http://192.168.50.215:8929/root/safetywallet/-/issues/14",
              author: { id: 7, username: "admin", name: "Admin" },
            }),
            { status: 201 },
          ),
        )
        .mockRejectedValueOnce("string-error-not-Error-instance");

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/issues",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "codex non-error",
            body: "details",
            assignCodex: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
    });
  });
});
