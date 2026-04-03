import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { success, error } from "../../../lib/response";
import {
  actions,
  actionImages,
  posts,
  siteMemberships,
} from "../../../db/schema";
import type { ActionsImageContext } from "./helpers";

export const deleteImageHandler = async (c: ActionsImageContext) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id")!;
  const imageId = c.req.param("imageId")!;

  const action = await db
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();
  if (!action) {
    return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, action.postId))
    .get();
  if (!post) {
    return error(c, "POST_NOT_FOUND", "Associated post not found", 404);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, post.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership || membership.role === "WORKER") {
    return error(c, "UNAUTHORIZED", "Not authorized", 403);
  }

  const image = await db
    .select()
    .from(actionImages)
    .where(
      and(eq(actionImages.id, imageId), eq(actionImages.actionId, actionId)),
    )
    .get();
  if (!image) {
    return error(c, "IMAGE_NOT_FOUND", "Image not found", 404);
  }

  await c.env.R2.delete(image.fileUrl);
  await db.delete(actionImages).where(eq(actionImages.id, imageId));
  return success(c, null);
};
