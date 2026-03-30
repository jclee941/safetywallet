"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, toast } from "@safetywallet/ui";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from "@/hooks/use-api";
import {
  AnnouncementCard,
  type Announcement,
} from "./components/announcement-card";
import { AnnouncementForm } from "./components/announcement-form";
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog";

export default function AnnouncementsPage() {
  const { data: announcements = [], isLoading } = useAdminAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = (data: {
    title: string;
    content: string;
    isPinned: boolean;
    scheduledAt: string | null;
  }) => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, ...data },
        { onSuccess: resetForm },
      );
    } else {
      createMutation.mutate(data, { onSuccess: resetForm });
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId, {
        onSuccess: () => {
          toast({ description: "삭제되었습니다." });
          setDeleteTargetId(null);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            description: "삭제 실패: " + err.message,
          });
          setDeleteTargetId(null);
        },
      });
    }
  };

  const sortedAnnouncements = [...(announcements as Announcement[])].sort(
    (a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">공지사항</h1>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 px-6 py-2.5 text-base font-semibold rounded-lg"
          >
            <Plus size={20} />새 공지 작성
          </Button>
        )}
      </div>

      {showForm && (
        <AnnouncementForm
          editingId={editingId}
          onSubmit={handleSubmit}
          onCancel={resetForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground">로딩 중...</p>
      ) : sortedAnnouncements.length === 0 ? (
        <p className="text-center text-muted-foreground">공지사항이 없습니다</p>
      ) : (
        <div className="space-y-4">
          {sortedAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
