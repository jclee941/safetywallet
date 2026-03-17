"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@safetywallet/ui";
import { useTranslation } from "@/hooks/use-translation";
import {
  flushOfflineQueue,
  getOfflineQueueLength,
  getBlockedItems,
  retryBlockedItem,
  dismissBlockedItem,
} from "@/lib/api";
import type { OfflineQueueEntry } from "@/lib/offline-queue";

export function OfflineQueueIndicator() {
  const t = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [blockedItems, setBlockedItems] = useState<OfflineQueueEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    const [pending, blocked] = await Promise.all([
      getOfflineQueueLength(),
      getBlockedItems(),
    ]);
    setPendingCount(pending);
    setBlockedItems(blocked);
    setIsOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    refreshState();

    const interval = window.setInterval(() => void refreshState(), 2000);
    const handleOnlineChange = () => void refreshState();

    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, [refreshState]);

  const handleSyncNow = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await flushOfflineQueue();
      await refreshState();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetry = async (id: string) => {
    await retryBlockedItem(id);
    await refreshState();
  };

  const handleDismiss = async (id: string) => {
    await dismissBlockedItem(id);
    await refreshState();
  };

  if (pendingCount === 0 && blockedItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-[320px] rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      {/* Pending items */}
      {pendingCount > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {t("components.offlineQueue.pending")}
            </span>
            <Badge variant="secondary">
              {pendingCount}
              {t("components.offlineQueue.countUnit")}
            </Badge>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              className="w-full"
              disabled={!isOnline || isSyncing}
              onClick={handleSyncNow}
            >
              {isSyncing
                ? t("components.offlineQueue.syncing")
                : isOnline
                  ? t("components.offlineQueue.syncNow")
                  : t("components.offlineQueue.offline")}
            </Button>
          </div>
        </>
      )}

      {/* Blocked items */}
      {blockedItems.length > 0 && (
        <div className={pendingCount > 0 ? "mt-3 border-t pt-3" : ""}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-destructive">
                {t("components.offlineQueue.blockedTitle")}
              </span>
              <Badge variant="destructive">{blockedItems.length}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowBlocked((prev) => !prev)}
            >
              {showBlocked
                ? t("components.offlineQueue.hideDetails")
                : t("components.offlineQueue.showDetails")}
            </Button>
          </div>

          {showBlocked && (
            <div className="mt-2 max-h-[200px] space-y-2 overflow-y-auto">
              {blockedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs"
                >
                  <div className="font-medium">{item.type}</div>
                  <div className="mt-0.5 truncate text-muted-foreground">
                    {item.lastError}
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-2 text-xs"
                      onClick={() => handleRetry(item.id)}
                    >
                      {t("components.offlineQueue.retry")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 flex-1 px-2 text-xs text-muted-foreground"
                      onClick={() => handleDismiss(item.id)}
                    >
                      {t("components.offlineQueue.dismiss")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
