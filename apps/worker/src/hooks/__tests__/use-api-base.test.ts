import { describe, expect, it } from "vitest";
import * as reactQuery from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import * as useApiBase from "@/hooks/use-api-base";
import { useAuthStore } from "@/stores/auth";

describe("use-api-base", () => {
  it("loads module through relative path", async () => {
    const module = await import("../use-api-base");
    expect(module.apiFetch).toBe(apiFetch);
  });

  it("re-exports react-query hooks", () => {
    expect(useApiBase.useQuery).toBe(reactQuery.useQuery);
    expect(useApiBase.useMutation).toBe(reactQuery.useMutation);
    expect(useApiBase.useQueryClient).toBe(reactQuery.useQueryClient);
  });

  it("re-exports apiFetch and useAuthStore", () => {
    expect(useApiBase.apiFetch).toBe(apiFetch);
    expect(useApiBase.useAuthStore).toBe(useAuthStore);
  });
});
