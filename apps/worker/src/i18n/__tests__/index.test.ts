import { describe, expect, it, vi } from "vitest";
import * as i18n from "@/i18n/index";
import { getLocale } from "@/i18n/loader";
import {
  createTranslator,
  getNestedValue,
  interpolate,
} from "@/i18n/translate";
import { defaultLocale, localeNames, locales } from "@/i18n/config";

vi.mock("@/i18n/context", () => ({
  I18nProvider: "mocked-provider",
  useI18n: vi.fn(() => ({ locale: "ko" })),
}));

describe("i18n/index", () => {
  it("re-exports key runtime APIs", () => {
    expect(i18n.I18nProvider).toBe("mocked-provider");
    expect(i18n.useI18n).toBeDefined();
    expect(i18n.getLocale).toBe(getLocale);
    expect(i18n.createTranslator).toBe(createTranslator);
    expect(i18n.getNestedValue).toBe(getNestedValue);
    expect(i18n.interpolate).toBe(interpolate);
  });

  it("re-exports locale config", () => {
    expect(i18n.defaultLocale).toBe(defaultLocale);
    expect(i18n.locales).toBe(locales);
    expect(i18n.localeNames).toBe(localeNames);
    expect(i18n.localeNames.ko).toBe("한국어");
  });
});
