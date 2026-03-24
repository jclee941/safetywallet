import { describe, expect, it } from "vitest";
import type {
  AnalyticsEngineDataset,
  AuthContext,
  Env,
  HyperdriveBinding,
  User,
} from "../../types";

describe("src/types module", () => {
  it("loads module and type contracts compile", async () => {
    const mod = await import("../../types");

    const user: User = {
      id: "u-1",
      phone: "01012345678",
      role: "WORKER",
      name: "홍길동",
      nameMasked: "홍*동",
    };

    const auth: AuthContext = {
      user,
      loginDate: "2026-03-24",
    };

    const hyperdrive: HyperdriveBinding = {
      connectionString: "mysql://user:pass@host:3306/db",
      host: "host",
      port: 3306,
      user: "user",
      password: "pass",
      database: "db",
    };

    const analytics: AnalyticsEngineDataset = {
      writeDataPoint: () => {
        return;
      },
    };

    const env = {
      DB: {} as D1Database,
      R2: {} as R2Bucket,
      ASSETS: {} as Fetcher,
      KV: {} as KVNamespace,
      JWT_SECRET: "jwt",
      HMAC_SECRET: "hmac",
      ENCRYPTION_KEY: "enc",
      REQUIRE_ATTENDANCE_FOR_LOGIN: "true",
      REQUIRE_ATTENDANCE_FOR_POST: "true",
      ENVIRONMENT: "test",
      FAS_HYPERDRIVE: hyperdrive,
      ANALYTICS: analytics,
    } satisfies Env;

    expect(typeof mod).toBe("object");
    expect(auth.user.name).toBe("홍길동");
    expect(env.FAS_HYPERDRIVE?.database).toBe("db");
  });
});
