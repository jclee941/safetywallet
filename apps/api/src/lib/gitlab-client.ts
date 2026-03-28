/**
 * GitLab API client wrapper for SafetyWallet.
 *
 * Migrated from GitHub API to GitLab API.
 * Provides typed methods for common GitLab operations.
 */

const GITLAB_PROJECT_ID = "qws941/safetywallet";

interface GitLabIssue {
  iid: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  created_at: string;
  updated_at: string;
  web_url: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
}

interface CreateIssueOptions {
  title: string;
  description?: string;
  labels?: string[];
}

interface GitLabComment {
  id: number;
  body: string;
  created_at: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
}

export class GitLabClient {
  private token: string;
  private baseUrl: string;
  private projectId: string;

  constructor(token: string, projectId: string = GITLAB_PROJECT_ID) {
    this.token = token;
    this.projectId = encodeURIComponent(projectId);
    this.baseUrl = "https://gitlab.com/api/v4";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "User-Agent": "safetywallet-api",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List issues in the project
   */
  async listIssues(
    options: {
      state?: "opened" | "closed" | "all";
      labels?: string;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<GitLabIssue[]> {
    const params = new URLSearchParams();
    if (options.state && options.state !== "all") {
      params.set("state", options.state);
    }
    if (options.labels) {
      params.set("labels", options.labels);
    }
    if (options.page) {
      params.set("page", String(options.page));
    }
    if (options.per_page) {
      params.set("per_page", String(options.per_page));
    }
    params.set("sort", "created_desc");

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.request<GitLabIssue[]>(
      `/projects/${this.projectId}/issues${queryString}`,
    );
  }

  /**
   * Create a new issue
   */
  async createIssue(options: CreateIssueOptions): Promise<GitLabIssue> {
    const body: Record<string, string> = {
      title: options.title,
    };
    if (options.description) {
      body.description = options.description;
    }
    if (options.labels && options.labels.length > 0) {
      body.labels = options.labels.join(",");
    }

    return this.request<GitLabIssue>(`/projects/${this.projectId}/issues`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Get a single issue by IID
   */
  async getIssue(iid: number): Promise<GitLabIssue> {
    return this.request<GitLabIssue>(
      `/projects/${this.projectId}/issues/${iid}`,
    );
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(iid: number, body: string): Promise<GitLabComment> {
    return this.request<GitLabComment>(
      `/projects/${this.projectId}/issues/${iid}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
    );
  }

  /**
   * Get project repository files
   */
  async getRepositoryFile(
    filePath: string,
    ref: string = "master",
  ): Promise<{
    file_name: string;
    file_path: string;
    content: string;
    encoding: string;
  }> {
    const encodedPath = encodeURIComponent(filePath);
    return this.request<{
      file_name: string;
      file_path: string;
      content: string;
      encoding: string;
    }>(
      `/projects/${this.projectId}/repository/files/${encodedPath}?ref=${ref}`,
    );
  }
}

/**
 * Create a GitLab client instance from environment
 */
export function createGitLabClient(token: string): GitLabClient {
  return new GitLabClient(token);
}
