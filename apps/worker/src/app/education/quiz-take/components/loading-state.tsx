"use client";

import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Skeleton } from "@safetywallet/ui";

export function LoadingState() {
  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />
      <main className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
      <BottomNav />
    </div>
  );
}
