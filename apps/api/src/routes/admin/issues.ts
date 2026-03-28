import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { parse } from "yaml";
import type { Env, AuthContext } from "../../types";
import { success, error } from "../../lib/response";
import { requireAdmin } from "./helpers";
import { createLogger } from "../../lib/logger";
import { GitLabClient } from "../../lib/gitlab-client";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
const logger = createLogger("admin/issues");

const GITLAB_PROJECT_ID = "root/safetywallet";

function toStatusCode(status: number): ContentfulStatusCode {
  if (status >= 400 && status <= 599) {
    return status as ContentfulStatusCode;
  }
  return 502;
}

function getGitLabErrorMessage(raw: string, fallback: string): string {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch (err) {
    logger.warn("Failed to parse GitLab error JSON", {
      error:
        err instanceof Error
          ? { name: err.name, message: err.message }
          : { name: "Unknown", message: String(err) },
    });
  }
  return raw.slice(0, 300);
}

/* ------------------------------------------------------------------ */
/*  Issue template types                                               */
/* ------------------------------------------------------------------ */

interface TemplateField {
  id: string;
  type: "textarea" | "dropdown";
  label: string;
  description?: string;
  placeholder?: string;
  options?: string[];
  required: boolean;
}

interface ParsedTemplate {
  slug: string;
  name: string;
  description: string;
  labels: string[];
  fields: TemplateField[];
}

const TEMPLATE_FILES = ["bug_report.md", "feature_request.md", "task.md"];
const KV_CACHE_KEY = "gitlab:issue-templates";
const KV_CACHE_TTL = 3600;

/** GET /issues/templates — fetch and parse GitLab issue templates */
app.get("/issues/templates", requireAdmin, async (c) => {
  const token = c.env.GITLAB_TOKEN;
  const kv = c.env.KV;

  // Check KV cache first
  if (kv) {
    try {
      const cached = await kv.get(KV_CACHE_KEY, "json");
      if (cached) return success(c, cached);
    } catch (err) {
      logger.error("Failed to read KV cache for issue templates", {
        error:
          err instanceof Error
            ? { name: err.name, message: err.message }
            : { name: "Unknown", message: String(err) },
      });
    }
  }

  if (!token) {
    return error(c, "MISSING_TOKEN", "GITLAB_TOKEN not configured", 503);
  }

  const client = new GitLabClient(token, GITLAB_PROJECT_ID);

  try {
    const templates: ParsedTemplate[] = [];

    for (const file of TEMPLATE_FILES) {
      try {
        const fileData = await client.getRepositoryFile(
          `.gitlab/issue_templates/${file}`,
          "master",
        );

        if (!fileData.content) continue;

        // Decode base64 content
        const decoded = atob(fileData.content);

        // Parse frontmatter from markdown
        const frontmatterMatch = decoded.match(
          /^\u003c!--\s*\n?([\s\S]*?)\n?\s*--\u003e/,
        );
        const yamlContent = frontmatterMatch ? frontmatterMatch[1] : "";
        const yml = parse(yamlContent) as {
          name?: string;
          description?: string;
          labels?: string[];
        };

        if (!yml?.name) continue;

        const slug = file.replace(/\.md$/, "");

        // Convert to field format similar to GitHub templates
        const fields: TemplateField[] = [];

        // Extract sections from markdown
        const sections = decoded.split(/^## /m).slice(1);
        for (const section of sections) {
          const lines = section.split("\n");
          const title = lines[0].trim();
          const content = lines.slice(1).join("\n").trim();

          // Check if it's a dropdown
          const dropdownMatch = content.match(/- \[([ x])\] (.+)/g);
          if (dropdownMatch) {
            const options: string[] = dropdownMatch.map((m: string) =>
              m.replace(/- \[[ x]\] /, "").trim(),
            );
            fields.push({
              id: title.toLowerCase().replace(/\s+/g, "_"),
              type: "dropdown",
              label: title,
              description: `Select ${title.toLowerCase()}`,
              options,
              required: false,
            });
          } else {
            fields.push({
              id: title.toLowerCase().replace(/\s+/g, "_"),
              type: "textarea",
              label: title,
              description: content.substring(0, 100),
              placeholder: content.includes("<!--")
                ? content.match(/\u003c!--\s*(.+?)\s*--\u003e/)?.[1] || ""
                : "",
              required: false,
            });
          }
        }

        templates.push({
          slug,
          name: yml.name,
          description: yml.description || "",
          labels: yml.labels || [],
          fields,
        });
      } catch (err) {
        logger.warn(`Failed to fetch template ${file}`, {
          error:
            err instanceof Error
              ? { name: err.name, message: err.message }
              : { name: "Unknown", message: String(err) },
        });
        continue;
      }
    }

    // Cache in KV
    if (kv && templates.length > 0) {
      try {
        await kv.put(KV_CACHE_KEY, JSON.stringify(templates), {
          expirationTtl: KV_CACHE_TTL,
        });
      } catch (err) {
        logger.error("Failed to write KV cache for issue templates", {
          error:
            err instanceof Error
              ? { name: err.name, message: err.message }
              : { name: "Unknown", message: String(err) },
        });
      }
    }

    return success(c, templates);
  } catch {
    return error(
      c,
      "GITLAB_UPSTREAM_UNAVAILABLE",
      "Failed to fetch issue templates from GitLab",
      502,
    );
  }
});

/** GET /issues — list GitLab issues */
app.get("/issues", requireAdmin, async (c) => {
  const token = c.env.GITLAB_TOKEN;

  if (!token) {
    return error(c, "MISSING_TOKEN", "GITLAB_TOKEN not configured", 503);
  }

  const state = c.req.query("state") || "opened";
  const labels = c.req.query("labels") || "";
  const page = parseInt(c.req.query("page") || "1", 10);
  const perPage = parseInt(c.req.query("per_page") || "30", 10);

  const client = new GitLabClient(token, GITLAB_PROJECT_ID);

  try {
    const issues = await client.listIssues({
      state: state === "all" ? "all" : state === "closed" ? "closed" : "opened",
      labels: labels || undefined,
      page,
      per_page: perPage,
    });

    // Transform GitLab issues to match GitHub format for compatibility
    const transformedIssues = issues.map((issue) => ({
      number: issue.iid,
      title: issue.title,
      body: issue.description,
      state: issue.state,
      labels: issue.labels.map((label) => ({ name: label })),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      html_url: issue.web_url,
      user: {
        login: issue.author.username,
        avatar_url: `http://192.168.50.215:8929/uploads/-/system/user/avatar/${issue.author.id}/avatar.png`,
      },
    }));

    return success(c, transformedIssues);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Failed to list GitLab issues", { error: message });
    return error(
      c,
      "GITLAB_UPSTREAM_UNAVAILABLE",
      "Failed to reach GitLab API",
      502,
    );
  }
});

/** POST /issues — create GitLab issue with optional codex assignment */
app.post("/issues", requireAdmin, async (c) => {
  const token = c.env.GITLAB_TOKEN;
  if (!token) {
    return error(c, "MISSING_TOKEN", "GITLAB_TOKEN not configured", 503);
  }

  let body: {
    title: string;
    body?: string;
    labels?: string[];
    assignCodex?: boolean;
  };

  try {
    body = await c.req.json<{
      title: string;
      body?: string;
      labels?: string[];
      assignCodex?: boolean;
    }>();
  } catch {
    return error(c, "INVALID_JSON", "Request body must be valid JSON", 400);
  }

  if (!body.title?.trim()) {
    return error(c, "INVALID_INPUT", "title is required");
  }

  const labels = body.labels || [];
  if (body.assignCodex && !labels.includes("codex")) {
    labels.push("codex");
  }

  const client = new GitLabClient(token, GITLAB_PROJECT_ID);

  try {
    // Create issue
    const issue = await client.createIssue({
      title: body.title.trim(),
      description: body.body?.trim() || "",
      labels,
    });

    // If codex assigned, post @codex comment so Codex agent picks it up
    if (body.assignCodex) {
      const commentBody = [`@codex ${issue.title}`, "", issue.description || ""]
        .join("\n")
        .trim();

      try {
        await client.createIssueComment(issue.iid, commentBody);
      } catch (err) {
        logger.error("Failed to post @codex comment", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Transform response to match GitHub format
    const transformedIssue = {
      number: issue.iid,
      title: issue.title,
      body: issue.description,
      state: issue.state,
      labels: issue.labels.map((label) => ({ name: label })),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      html_url: issue.web_url,
    };

    return success(c, transformedIssue, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Failed to create GitLab issue", { error: message });
    return error(
      c,
      "GITLAB_UPSTREAM_UNAVAILABLE",
      "Failed to reach GitLab API",
      502,
    );
  }
});

export default app;
