import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker, getInitialDateRange } from "./date-range-picker";

describe("DateRangePicker", () => {
  it("provides initial 30-day preset", () => {
    const initial = getInitialDateRange();
    expect(initial.preset).toBe("30d");
    expect(initial.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(initial.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("emits preset and custom range changes", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          preset: "30d",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "최근 7일" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: "7d",
      }),
    );

    const dateInputs = screen.getAllByDisplayValue(/2026-02/);
    fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } });
    expect(onChange).toHaveBeenCalledWith({
      startDate: "2026-01-01",
      endDate: "2026-02-28",
      preset: "custom",
    });
  });

  it("emits 30d and 90d preset changes", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          preset: "7d",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "최근 30일" }));
    fireEvent.click(screen.getByRole("button", { name: "최근 90일" }));

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ preset: "30d" }),
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ preset: "90d" }),
    );
  });

  it("emits custom endDate changes", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          preset: "30d",
        }}
        onChange={onChange}
      />,
    );

    const dateInputs = screen.getAllByDisplayValue(/2026-02/);
    fireEvent.change(dateInputs[1], { target: { value: "2026-03-01" } });

    expect(onChange).toHaveBeenCalledWith({
      startDate: "2026-02-01",
      endDate: "2026-03-01",
      preset: "custom",
    });
  });
});
