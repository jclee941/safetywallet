import { describe, expect, it } from "vitest";

describe("use-education-api-types", () => {
  it("is importable as a type-only module at runtime", async () => {
    const mod = await import("@/hooks/use-education-api-types");

    expect(mod).toBeTypeOf("object");
    expect(Object.keys(mod)).toEqual([]);
  });
});
