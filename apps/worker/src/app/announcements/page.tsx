"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { useAnnouncements } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent, Skeleton, Badge } from "@safetywallet/ui";
import type { AnnouncementDto } from "@safetywallet/types";

type AnnouncementType =
  | "RANKING"
  | "BEST_PRACTICE"
  | "ACTION_COMPLETE"
  | "REWARD"
  | "GENERAL";

// Type guard for announcements
type Announcement = AnnouncementDto & { type?: AnnouncementType };

export default function AnnouncementsPage() {
  const t = useTranslation();
  const { currentSiteId } = useAuth();
  const { data: announcements, isLoading } = useAnnouncements(
    currentSiteId || "",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getTypeConfig = (
    type?: AnnouncementType,
  ): { icon: string; label: string; color: string } => {
    const configs: Partial<
      Record<AnnouncementType, { icon: string; label: string; color: string }>
    > = {
      RANKING: {
        icon: "🏆",
        label: t("announcements.types.RANKING"),
        color: "bg-yellow-100 text-yellow-800",
      },
      BEST_PRACTICE: {
        icon: "⭐",
        label: t("announcements.types.BEST_PRACTICE"),
        color: "bg-blue-100 text-blue-800",
      },
      ACTION_COMPLETE: {
        icon: "✅",
        label: t("announcements.types.ACTION_COMPLETE"),
        color: "bg-green-100 text-green-800",
      },
      REWARD: {
        icon: "🎁",
        label: t("announcements.types.REWARD"),
        color: "bg-purple-100 text-purple-800",
      },
      GENERAL: {
        icon: "📢",
        label: t("announcements.types.GENERAL"),
        color: "bg-muted text-foreground",
      },
    };
    return (
      configs[type || "GENERAL"] || {
        icon: "📢",
        label: t("announcements.types.GENERAL"),
        color: "bg-muted text-foreground",
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted pb-nav">
        <Header />
        <main className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  const items = announcements?.data || [];

  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />

      <main className="p-4">
        <h2 className="text-lg font-bold mb-4">{t("announcements.title")}</h2>

        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-4">📭</p>
            <p>{t("announcements.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((announcement) => {
              const typeConfig = getTypeConfig(
                (announcement as Announcement).type ?? "GENERAL",
              );
              const isExpanded = expandedId === announcement.id;

              return (
                <Card
                  key={announcement.id}
                  className="active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : announcement.id)
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl shrink-0">{typeConfig.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={typeConfig.color}
                            variant="secondary"
                          >
                            {typeConfig.label}
                          </Badge>
                          {announcement.isPinned && (
                            <Badge variant="destructive">📌</Badge>
                          )}
                        </div>
                        <h3 className="font-medium text-sm line-clamp-2 mb-1">
                          {announcement.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(announcement.createdAt).toLocaleDateString(
                            "ko-KR",
                          )}
                        </p>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground whitespace-pre-wrap break-words">
                            {announcement.content ||
                              t("announcements.noContent")}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
