import { describe, expect, it } from "vitest";

describe("use-education-api-types", () => {
  it("is importable as a type-only module at runtime", async () => {
    const module = await import("@/hooks/use-education-api-types");

    expect(module).toBeTypeOf("object");
    expect(Object.keys(module)).toEqual([]);
  });
});
