"use client";

import { Pin, Edit2, Trash2, Clock } from "lucide-react";
import { Button, Card, Badge } from "@safetywallet/ui";
import { renderAnnouncementHtml } from "../utils";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  scheduledAt: string | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  createdAt: string;
}

interface AnnouncementCardProps {
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function AnnouncementCard({
  announcement,
  onEdit,
  onDelete,
  isDeleting,
}: AnnouncementCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            {announcement.isPinned && (
              <Pin size={16} className="text-primary" />
            )}
            <h3 className="font-semibold break-words">{announcement.title}</h3>
            {announcement.isPinned && <Badge variant="secondary">고정</Badge>}
            {announcement.status === "SCHEDULED" && (
              <Badge variant="outline" className="gap-1">
                <Clock size={12} />
                예약
              </Badge>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            {renderAnnouncementHtml(announcement.content)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {new Date(announcement.createdAt).toLocaleString("ko-KR")}
            {announcement.scheduledAt && (
              <span className="ml-2">
                · 예약:{" "}
                {new Date(announcement.scheduledAt).toLocaleString("ko-KR")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(announcement)}
          >
            <Edit2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(announcement.id)}
            disabled={isDeleting}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
