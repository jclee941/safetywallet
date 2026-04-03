import { z } from "zod";
import { ActionStatusUpdate, uuid, isoDateStr } from "./shared.js";

export const CreateActionSchema = z.object({
  postId: uuid,
  assigneeType: z.string().min(1),
  assigneeId: uuid.optional(),
  dueDate: isoDateStr.optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  description: z.string().optional(),
});

export const UpdateActionStatusSchema = z.object({
  actionStatus: z.enum(ActionStatusUpdate),
  completionNote: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export const AdminEmergencyActionPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmActionId: z.string().min(1),
});
