import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetadataCard } from "../metadata-card";

vi.mock("@safetywallet/ui", async () => {
  const React = await import("react");
  return {
    Card: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("MetadataCard", () => {
  it("renders all metadata entries as strings", () => {
    render(
      <MetadataCard
        metadata={{
          source: "mobile",
          count: 3,
          enabled: true,
          detail: null,
        }}
      />,
    );

    expect(screen.getByText("추가 정보")).toBeInTheDocument();
    expect(screen.getByText("source")).toBeInTheDocument();
    expect(screen.getByText("mobile")).toBeInTheDocument();
    expect(screen.getByText("count")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("enabled")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("detail")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();
  });
});
