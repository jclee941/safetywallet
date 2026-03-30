import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { PostsRouteApp } from "./helpers";
import { attendanceMiddleware } from "../../middleware/attendance";
import { success, error } from "../../lib/response";
import { postImages, posts } from "../../db/schema";

export const registerDeleteRoutes = (app: PostsRouteApp): void => {
  app.delete("/:id", async (c) => {
    await attendanceMiddleware(c, async () => {});
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const postId = c.req.param("id");

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      return error(c, "POST_NOT_FOUND", "Post not found", 404);
    }

    if (post.userId !== user.id && user.role !== "SITE_ADMIN") {
      return error(
        c,
        "UNAUTHORIZED",
        "Not authorized to delete this post",
        403,
      );
    }

    const images = await db
      .select()
      .from(postImages)
      .where(eq(postImages.postId, postId))
      .all();

    for (const image of images) {
      await c.env.R2.delete(image.fileUrl);
    }

    await db.delete(posts).where(eq(posts.id, postId));

    return success(c, null);
  });
};
