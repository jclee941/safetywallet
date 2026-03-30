import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { success, error } from "../../lib/response";
import { log } from "../../lib/observability";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

/**
 * Retrieve image with privacy metadata
 *
 * GET /api/images/info/:filename
 *
 * Returns:
 *   - filename: Image filename
 *   - url: Public URL
 *   - metadata: Privacy processing metadata from R2
 */
app.get("/info/:filename{.+}", async (c) => {
  const { user } = c.get("auth");
  const filename = c.req.param("filename");

  try {
    const object = await c.env.R2.head(filename);

    if (!object) {
      return error(c, "NOT_FOUND", "Image not found", 404);
    }

    return success(c, {
      filename,
      url: `/r2/${filename}`,
      size: object.size,
      contentType: object.httpMetadata?.contentType,
      uploadedAt: object.customMetadata?.["uploaded-at"],
      uploadedBy: object.customMetadata?.["uploaded-by"],
      privacyProcessed: object.customMetadata?.["privacy-processed"] === "true",
      exifStripped: object.customMetadata?.["exif-stripped"] === "true",
      metadata: object.customMetadata,
    });
  } catch (err) {
    log.error("Failed to retrieve image info", err, {
      action: "image_info_failed",
      userId: user.id,
      metadata: { filename },
    });

    return error(c, "FETCH_FAILED", "Failed to retrieve image info", 500);
  }
});

export default app;
