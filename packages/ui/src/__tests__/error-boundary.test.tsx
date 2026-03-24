import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../components/error-boundary";

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child-content">Hello World</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("shows Korean error UI with retry button when error is caught", () => {
    const ThrowError = () => {
      throw new Error("test error");
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByText("다시 시도해 주세요")).toBeInTheDocument();
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
  });

  it("shows custom fallback when provided", () => {
    const ThrowError = () => {
      throw new Error("test error");
    };

    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom Fallback</div>}
      >
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByText("오류가 발생했습니다")).not.toBeInTheDocument();
  });

  it("handleRetry calls window.location.reload()", () => {
    const reloadSpy = vi.spyOn(window.location, "reload");
    const ThrowError = () => {
      throw new Error("test error");
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    const retryButton = screen.getByText("다시 시도");
    retryButton.click();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("componentDidCatch logs to console.error", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const ThrowError = () => {
      throw new Error("test error");
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.any(Object),
    );

    consoleErrorSpy.mockRestore();
  });

  it("getDerivedStateFromError returns hasError true with error", () => {
    const ThrowError = () => {
      throw new Error("test error");
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // When error boundary catches error, it sets state.hasError = true
    // Verify the error message is displayed via the fallback
    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
  });
});
