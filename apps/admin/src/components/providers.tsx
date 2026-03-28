"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@safetywallet/ui";
import { useAuthStore } from "@/stores/auth";
import { useMySites } from "@/hooks/use-admin-api";

function SiteBootstrap({ children }: { children: ReactNode }) {
  const { currentSiteId, setSiteId } = useAuthStore();
  const { data: sites, isLoading: isSitesLoading } = useMySites();

  useEffect(() => {
    if (!currentSiteId && sites && sites.length > 0) {
      setSiteId(sites[0].siteId);
    }
  }, [currentSiteId, sites, setSiteId]);

  if (!currentSiteId) {
    if (isSitesLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          현장 정보를 불러오는 중입니다...
        </div>
      );
    }

    if (sites && sites.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center text-slate-700">
          계정의 현장 배정 정보를 아직 불러오지 못했습니다. 잠시 후 새로고침해
          주세요. 계속되면 권한 관리자에게 문의하세요.
        </div>
      );
    }
  }

  return <>{children}</>;
}

function SiteBootstrapGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, _hasHydrated } = useAuthStore();
  const isLoginPage = pathname === "/login" || pathname === "/login/";

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        로딩 중...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <>{children}</>;
  }

  return <SiteBootstrap>{children}</SiteBootstrap>;
}

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
      <SiteBootstrapGate>{children}</SiteBootstrapGate>
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
