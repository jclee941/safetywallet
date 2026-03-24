import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { cn as uiCn } from "@safetywallet/ui";

describe("cn", () => {
  it("re-exports the shared ui cn function", () => {
    expect(cn).toBe(uiCn);
  });

  it("merges class values and removes conflicting tailwind utilities", () => {
    expect(cn("px-2", "text-sm", "px-4", { "font-bold": true })).toBe(
      "text-sm px-4 font-bold",
    );
  });

  it("returns empty string for empty inputs", () => {
    expect(cn(undefined, null, false, "")).toBe("");
  });
});
