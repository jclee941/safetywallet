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
    GITHUB_TOKEN: "token",
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

    it("fetches and parses templates from GitHub when cache is empty", async () => {
      const yml = btoa(
        [
          "name: Bug report",
          "description: Report a bug",
          "labels:",
          "  - bug",
          "body:",
          "  - type: textarea",
          "    id: details",
          "    attributes:",
          "      label: Details",
          "    validations:",
          "      required: true",
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

    it("returns 502 when upstream fetch throws", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(502);
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
          "name: No Labels Template",
          "description: A template without labels",
          "body:",
          "  - type: textarea",
          "    id: info",
          "    attributes:",
          "      label: Info",
          "    validations:",
          "      required: false",
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
          "name: Bug report",
          "description: Report a bug",
          "labels:",
          "  - bug",
          "body:",
          "  - type: textarea",
          "    id: details",
          "    attributes:",
          "      label: Details",
          "    validations:",
          "      required: true",
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

    it("fetches templates without Authorization header when GITHUB_TOKEN is absent", async () => {
      const yml = btoa(
        [
          "name: Task",
          "description: A task",
          "body:",
          "  - type: textarea",
          "    id: info",
          "    attributes:",
          "      label: Info",
        ].join("\n"),
      );

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: yml }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(new Response("", { status: 404 }));

      const { app, env } = await createApp(makeAuth(), {
        GITHUB_TOKEN: "",
        KV: {
          get: vi.fn(async () => null),
          put: vi.fn(async () => undefined),
        },
      });

      const res = await app.request("/issues/templates", {}, env);
      expect(res.status).toBe(200);
      const callHeaders = fetchSpy.mock.calls[0][1] as {
        headers: Record<string, string>;
      };
      expect(callHeaders.headers.Authorization).toBeUndefined();
    });

    it("skips templates when GitHub response has no content field", async () => {
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

    it("skips templates when YAML has no name field", async () => {
      const yml = btoa(
        [
          "description: no name",
          "body:",
          "  - type: textarea",
          "    id: x",
          "    attributes:",
          "      label: X",
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
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("skips body entries with unsupported types or missing attributes", async () => {
      const yml = btoa(
        [
          "name: Mixed",
          "description: mixed types",
          "body:",
          "  - type: markdown",
          "    id: md1",
          "    attributes:",
          "      label: MD",
          "  - type: textarea",
          "    attributes:",
          "      label: NoId",
          "  - type: dropdown",
          "    id: dd1",
          "  - type: textarea",
          "    id: valid",
          "    attributes:",
          "      label: Valid",
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

    it("returns issues without auth header when GITHUB_TOKEN is absent", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1, title: "public issue" }]), {
          status: 200,
        }),
      );
      const { app, env } = await createApp(makeAuth(), { GITHUB_TOKEN: "" });

      const res = await app.request("/issues", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: number }> };
      expect(body.data).toHaveLength(1);
      const callHeaders = fetchSpy.mock.calls[0][1] as {
        headers: Record<string, string>;
      };
      expect(callHeaders.headers.Authorization).toBeUndefined();
    });

    it("returns upstream error status and message", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
      );
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues?state=closed", {}, env);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain("Not Found");
    });

    it("filters out pull requests from issue list", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 1, title: "Issue one" },
            { id: 2, title: "PR one", pull_request: { url: "x" } },
          ]),
          { status: 200 },
        ),
      );
      const { app, env } = await createApp(makeAuth());

      const res = await app.request("/issues?labels=bug", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: number }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(1);
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
    it("returns 503 when GITHUB_TOKEN is missing", async () => {
      const { app, env } = await createApp(makeAuth(), { GITHUB_TOKEN: "" });
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

    it("returns GitHub error when issue creation fails", async () => {
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
      expect(res.status).toBe(422);
    });

    it("creates issue successfully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 11,
            node_id: "NODE_1",
            title: "new issue",
            body: "details",
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
              number: 12,
              node_id: "NODE_2",
              title: "codex issue",
              body: "details",
            }),
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), { status: 201 }),
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
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("still returns 201 when codex follow-up calls fail", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              number: 13,
              node_id: "NODE_3",
              title: "codex issue failure path",
              body: "details",
            }),
            { status: 201 },
          ),
        )
        .mockRejectedValueOnce(new Error("graphql down"))
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
              number: 15,
              node_id: "NODE_5",
              title: "no-body issue",
              body: null,
            }),
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 2 }), { status: 201 }),
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
      const commentCall = fetchSpy.mock.calls[2];
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
              number: 14,
              node_id: "NODE_4",
              title: "codex non-error",
              body: "details",
            }),
            { status: 201 },
          ),
        )
        .mockRejectedValueOnce("string-error-not-Error-instance")
        .mockRejectedValueOnce("another-string-error");

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
