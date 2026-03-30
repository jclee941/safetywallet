import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, gte } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { success, error } from "../../lib/response";
import { processImageForPrivacy, isJpegImage } from "../../lib/image-privacy";
import { computeImageHash, hammingDistance } from "../../lib/phash";
import { log, startTimer } from "../../lib/observability";
import { trackEvent } from "../../middleware/analytics";
import { postImages, posts, siteMemberships } from "../../db/schema";
import {
  classifyHazard,
  detectObjects,
  filterPersonDetections,
} from "../../lib/workers-ai";
import { blurPersonRegions } from "../../lib/face-blur";
import { analyzeHazardImage, getAiCredentials } from "../../lib/gemini-ai";

const uploadRateLimit = rateLimitMiddleware({
  maxRequests: 20,
  windowMs: 60_000,
});

const DUPLICATE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_HAMMING_THRESHOLD = 5;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

/**
 * Upload image with automatic EXIF stripping for privacy
 *
 * POST /api/images/upload
 * Content-Type: multipart/form-data
 *
 * Body:
 *   - file: Image file (JPEG, PNG, WebP, GIF)
 *   - context: Optional context (post, profile, site)
 *
 * Returns:
 *   - fileUrl: R2 URL for the uploaded image
 *   - privacyProcessed: Whether EXIF was stripped
 *   - metadata: Privacy processing metadata
 */
app.post("/upload", uploadRateLimit, async (c) => {
  const timer = startTimer();
  const { user } = c.get("auth");

  try {
    const db = drizzle(c.env.DB);
    const formData = await c.req.formData();
    const rawFile = formData.get("file");
    const context = formData.get("context") as string | null;
    const rawSiteId = formData.get("siteId");

    if (!rawFile || typeof rawFile === "string") {
      return error(c, "MISSING_FILE", "File is required", 400);
    }

    // CF Workers FormData returns File objects for file inputs;
    // TS narrows to never due to workers-types missing File in FormDataEntryValue union
    const file = rawFile as unknown as {
      name: string;
      size: number;
      type: string;
      arrayBuffer(): Promise<ArrayBuffer>;
    };

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return error(
        c,
        "FILE_TOO_LARGE",
        `File must be less than ${maxSize / (1024 * 1024)}MB`,
        400,
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return error(
        c,
        "INVALID_FILE_TYPE",
        `File type must be one of: ${allowedTypes.join(", ")}`,
        400,
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();

    const { buffer: exifStrippedBuffer, metadata: privacyMetadata } =
      await processImageForPrivacy(arrayBuffer, file.name);

    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split("-")[0];
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${context || "upload"}/${timestamp}-${randomId}.${extension}`;

    let publicBuffer = exifStrippedBuffer;
    const faceBlurMetadata: Record<string, string> = {};

    if (c.env.AI && isJpegImage(exifStrippedBuffer)) {
      try {
        const detections = await detectObjects(c.env.AI, exifStrippedBuffer);
        const persons = filterPersonDetections(detections);
        faceBlurMetadata["face-detection-ran"] = "true";

        if (persons.length > 0) {
          await c.env.R2.put(`original/${filename}`, exifStrippedBuffer, {
            httpMetadata: { contentType: file.type },
            customMetadata: {
              ...privacyMetadata,
              "access-level": "admin-only",
              "uploaded-by": user.id,
              "uploaded-at": new Date().toISOString(),
            },
          });

          const blurResult = await blurPersonRegions(
            exifStrippedBuffer,
            persons,
          );
          publicBuffer = blurResult.buffer;
          faceBlurMetadata["face-blur-applied"] = "true";
          faceBlurMetadata["person-detections-count"] = String(
            blurResult.blurredCount,
          );
        } else {
          faceBlurMetadata["face-blur-applied"] = "false";
        }
      } catch (faceErr) {
        log.warn("Face detection/blur failed, proceeding without blur", {
          action: "face_blur_skipped",
          userId: user.id,
          metadata: {
            filename,
            error: faceErr instanceof Error ? faceErr.message : "unknown",
          },
        });
        faceBlurMetadata["face-detection-ran"] = "false";
        faceBlurMetadata["face-detection-error"] = "true";
      }
    }

    // Compute perceptual hash for duplicate detection
    let imageHash: string | null = null;
    let duplicateReference: {
      postId: string;
      fileUrl: string;
      distance: number;
    } | null = null;

    const requestedSiteId =
      typeof rawSiteId === "string" && rawSiteId.trim().length > 0
        ? rawSiteId.trim()
        : null;

    try {
      imageHash = await computeImageHash(publicBuffer);

      if (imageHash) {
        let effectiveSiteId = requestedSiteId;
        if (!effectiveSiteId) {
          const activeMemberships = await db
            .select({ siteId: siteMemberships.siteId })
            .from(siteMemberships)
            .where(
              and(
                eq(siteMemberships.userId, user.id),
                eq(siteMemberships.status, "ACTIVE"),
              ),
            )
            .all();

          if (activeMemberships.length === 1) {
            effectiveSiteId = activeMemberships[0].siteId;
          }
        }

        if (effectiveSiteId) {
          const cutoff = new Date(Date.now() - DUPLICATE_LOOKBACK_MS);
          const recentImages = await db
            .select({
              postId: postImages.postId,
              fileUrl: postImages.fileUrl,
              imageHash: postImages.imageHash,
            })
            .from(postImages)
            .innerJoin(posts, eq(posts.id, postImages.postId))
            .where(
              and(
                eq(posts.siteId, effectiveSiteId),
                gte(posts.createdAt, cutoff),
              ),
            )
            .orderBy(desc(posts.createdAt))
            .limit(300)
            .all();

          for (const recent of recentImages) {
            if (!recent.imageHash) {
              continue;
            }

            const distance = hammingDistance(imageHash, recent.imageHash);
            if (distance <= DUPLICATE_HAMMING_THRESHOLD) {
              duplicateReference = {
                postId: recent.postId,
                fileUrl: recent.fileUrl,
                distance,
              };
              break;
            }
          }
        }
      }
    } catch (hashErr) {
      log.warn("Image duplicate check skipped due to pHash error", {
        action: "phash_duplicate_check_skipped",
        userId: user.id,
        metadata: {
          filename,
          error: hashErr instanceof Error ? hashErr.message : "unknown",
        },
      });
    }

    if (duplicateReference) {
      return error(
        c,
        "DUPLICATE_IMAGE",
        `Near-duplicate image found in post ${duplicateReference.postId}`,
        409,
      );
    }

    await c.env.R2.put(filename, publicBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        ...privacyMetadata,
        ...faceBlurMetadata,
        "uploaded-by": user.id,
        "uploaded-at": new Date().toISOString(),
        "original-size": String(file.size),
        "processed-size": String(publicBuffer.byteLength),
      },
    });

    const fileUrl = `/r2/${filename}`;

    if (c.env.AI) {
      const aiPromise = classifyHazard(c.env.AI, publicBuffer)
        .then(async (result) => {
          if (result) {
            const obj = await c.env.R2.head(filename);
            if (obj) {
              await c.env.R2.put(filename, publicBuffer, {
                httpMetadata: { contentType: file.type },
                customMetadata: {
                  ...obj.customMetadata,
                  "ai-hazard-type": result.hazardType,
                  "ai-confidence": String(result.confidence),
                  "ai-raw-label": result.rawLabel,
                },
              });
            }
          }
        })
        .catch(() => {
          // AI classification is best-effort; silently ignore failures
        });
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(aiPromise);
      }
    }

    const aiConfig = getAiCredentials(c.env);
    if (aiConfig) {
      const analysisPromise = analyzeHazardImage(
        aiConfig,
        publicBuffer,
        file.type,
      )
        .then(async (result) => {
          if (result) {
            // Store full analysis as separate R2 object
            await c.env.R2.put(
              `ai-analysis/${filename}.json`,
              JSON.stringify(result),
              {
                httpMetadata: { contentType: "application/json" },
              },
            );
            // Store summary in image's R2 customMetadata
            const obj = await c.env.R2.head(filename);
            if (obj) {
              await c.env.R2.put(filename, publicBuffer, {
                httpMetadata: { contentType: file.type },
                customMetadata: {
                  ...obj.customMetadata,
                  "ai-hazard-analysis-type": result.hazardType,
                  "ai-hazard-analysis-severity": result.severity,
                  "ai-hazard-analysis-confidence": String(result.confidence),
                },
              });
            }
          }
        })
        .catch(() => undefined);
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(analysisPromise);
      }
    }

    trackEvent(c, "image_uploaded", {
      userId: user.id,
      category: context || "unknown",
      count: 1,
      value: publicBuffer.byteLength,
    });

    log.info("Image uploaded successfully", {
      action: "image_upload",
      userId: user.id,
      metadata: {
        filename,
        originalSize: file.size,
        processedSize: publicBuffer.byteLength,
        privacyProcessed: privacyMetadata["privacy-processed"],
        exifStripped: privacyMetadata["exif-stripped"],
      },
    });

    timer.end("image_upload", { userId: user.id });

    return success(c, {
      fileUrl,
      filename,
      imageHash,
      originalSize: file.size,
      processedSize: publicBuffer.byteLength,
      privacyProcessed: privacyMetadata["privacy-processed"] === "true",
      exifStripped: privacyMetadata["exif-stripped"] === "true",
      metadata: privacyMetadata,
    });
  } catch (err) {
    log.error("Image upload failed", err, {
      action: "image_upload_failed",
      userId: user.id,
    });

    timer.end("image_upload_failed", { userId: user.id });

    return error(c, "UPLOAD_FAILED", "Failed to upload image", 500);
  }
});

export default app;
