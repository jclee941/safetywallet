"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { Toaster } from "@safetywallet/ui";
import { AuthGuard } from "./auth-guard";
import { OfflineQueueIndicator } from "./offline-queue-indicator";
import { I18nProvider } from "@/i18n";
import { InstallBanner } from "./install-banner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale="ko">
        <AuthGuard>{children}</AuthGuard>
        <OfflineQueueIndicator />
        <Toaster />
        <InstallBanner />
      </I18nProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
