import { describe, expect, it } from "vitest";
import { extractCreateData, extractUpdateData } from "../policy-helpers";

describe("policy helpers", () => {
  it("extracts create payload with optional numeric fields", () => {
    const formData = new FormData();
    formData.set("name", "정책");
    formData.set("reasonCode", "SAFE");
    formData.set("description", "desc");
    formData.set("defaultAmount", "10");
    formData.set("minAmount", "1");
    formData.set("maxAmount", "20");
    formData.set("dailyLimit", "2");
    formData.set("monthlyLimit", "8");

    expect(extractCreateData(formData, "site-1")).toEqual({
      siteId: "site-1",
      name: "정책",
      reasonCode: "SAFE",
      description: "desc",
      defaultAmount: 10,
      minAmount: 1,
      maxAmount: 20,
      dailyLimit: 2,
      monthlyLimit: 8,
    });
  });

  it("extracts create/update payloads with empty optionals and inactive switch", () => {
    const formData = new FormData();
    formData.set("name", "정책");
    formData.set("description", "desc");
    formData.set("defaultAmount", "15");
    formData.set("minAmount", "");
    formData.set("maxAmount", "");
    formData.set("dailyLimit", "");
    formData.set("monthlyLimit", "");

    expect(extractCreateData(formData, "site-2")).toEqual({
      siteId: "site-2",
      name: "정책",
      reasonCode: null,
      description: "desc",
      defaultAmount: 15,
      minAmount: undefined,
      maxAmount: undefined,
      dailyLimit: undefined,
      monthlyLimit: undefined,
    });

    expect(extractUpdateData(formData)).toEqual({
      name: "정책",
      description: "desc",
      defaultAmount: 15,
      minAmount: undefined,
      maxAmount: undefined,
      dailyLimit: undefined,
      monthlyLimit: undefined,
      isActive: false,
    });

    formData.set("isActive", "on");
    expect(extractUpdateData(formData).isActive).toBe(true);
  });
});
