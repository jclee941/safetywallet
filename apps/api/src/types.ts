// Hyperdrive binding type for external database connections
export interface HyperdriveBinding {
  connectionString: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// Analytics Engine binding for observability metrics
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
}

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  KV: KVNamespace;
  JWT_SECRET: string;
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
  REQUIRE_ATTENDANCE_FOR_LOGIN: string;
  REQUIRE_ATTENDANCE_FOR_POST: string;
  ENVIRONMENT: string;
  RATE_LIMITER?: DurableObjectNamespace;
  JOB_SCHEDULER?: DurableObjectNamespace;
  SMS_API_KEY?: string;
  SMS_API_SECRET?: string;
  SMS_SENDER?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  // AceTime FAS MariaDB via Hyperdrive
  FAS_HYPERDRIVE?: HyperdriveBinding;
  FAS_COMPANY_ID?: string;
  FAS_DB_NAME?: string;
  FAS_SITE_CD?: string;
  FAS_SYNC_SECRET?: string;
  FAS_SITE_NAME?: string;
  // Admin credentials
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  // Analytics Engine for observability
  ANALYTICS?: AnalyticsEngineDataset;
  ELASTICSEARCH_URL?: string;
  ELASTICSEARCH_INDEX_PREFIX?: string;
  ALERT_WEBHOOK_URL?: string;
  NOTIFICATION_QUEUE?: Queue;
  AI?: Ai;
  // Comma-separated allowed CORS origins
  ALLOWED_ORIGINS?: string;
  // VAPID contact for web push
  VAPID_SUBJECT?: string;
  // GitLab API token for issue management
  GITLAB_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL_TEXT?: string;
  OPENROUTER_MODEL_MULTIMODAL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}

export interface User {
  id: string;
  phone: string;
  role: string;
  name: string;
  nameMasked: string;
}

export interface AuthContext {
  user: User;
  loginDate: string;
}
