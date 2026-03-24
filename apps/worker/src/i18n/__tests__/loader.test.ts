import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/i18n/config";

afterEach(() => {
  vi.unmock("@/locales/en.json");
  vi.unmock("../config");
  vi.restoreAllMocks();
});

describe("i18n loader", () => {
  it("loads default locale when locale is omitted", async () => {
    vi.resetModules();
    const { getLocale } = await import("@/i18n/loader");
    const ko = (await import("@/locales/ko.json")).default;

    await expect(getLocale()).resolves.toEqual(ko);
  });

  it("loads en locale successfully", async () => {
    vi.resetModules();
    const { getLocale } = await import("@/i18n/loader");
    const en = (await import("@/locales/en.json")).default;

    await expect(getLocale("en")).resolves.toEqual(en);
  });

  it("loads vi and zh locales", async () => {
    vi.resetModules();
    const { getLocale } = await import("@/i18n/loader");
    const viLocale = (await import("@/locales/vi.json")).default;
    const zhLocale = (await import("@/locales/zh.json")).default;

    await expect(getLocale("vi")).resolves.toEqual(viLocale);
    await expect(getLocale("zh")).resolves.toEqual(zhLocale);
  });

  it("falls back to default locale for unsupported locale", async () => {
    vi.resetModules();
    const { getLocale } = await import("@/i18n/loader");
    const ko = (await import("@/locales/ko.json")).default;

    await expect(getLocale("fr" as Locale)).resolves.toEqual(ko);
  });

  it("handles loader errors and falls back to default locale", async () => {
    vi.resetModules();
    vi.doMock("@/locales/en.json", () => {
      throw new Error("mocked locale import failure");
    });

    const { getLocale } = await import("@/i18n/loader");
    const ko = (await import("@/locales/ko.json")).default;

    await expect(getLocale("en")).resolves.toEqual(ko);
  });

  it("silently falls back for unsupported locale in production mode", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const { getLocale } = await import("@/i18n/loader");
    const ko = (await import("@/locales/ko.json")).default;

    try {
      await expect(getLocale("fr" as Locale)).resolves.toEqual(ko);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("silently falls back on loader error in production mode", async () => {
    vi.resetModules();
    vi.doMock("@/locales/en.json", () => {
      throw new Error("mocked locale import failure");
    });

    vi.stubEnv("NODE_ENV", "production");
    const { getLocale } = await import("@/i18n/loader");
    const ko = (await import("@/locales/ko.json")).default;

    try {
      await expect(getLocale("en")).resolves.toEqual(ko);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("throws when configured default locale loader is missing", async () => {
    vi.resetModules();
    vi.doMock("../config", async () => {
      const actual =
        await vi.importActual<typeof import("../config")>("../config");
      return {
        ...actual,
        defaultLocale: "fr",
      };
    });

    const { getLocale } = await import("@/i18n/loader");

    await expect(getLocale("fr" as Locale)).rejects.toThrow(
      "Default locale fr not found",
    );
  });
});
