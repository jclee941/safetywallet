import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { tbmRecords } from "../../../db/schema";
import { getAiCredentials } from "../../../lib/ai/base";
import {
  analyzeTbmRecord,
  generateTbmMeetingMinutes,
} from "../../../lib/ai/tbm";
import { createLogger } from "../../../lib/logger";
import type { AppType } from "../helpers";

const logger = createLogger("tbm");

export function enqueueTbmAiJobs(
  c: { env: AppType["Bindings"]; executionCtx: ExecutionContext },
  tbm: {
    id: string;
    topic: string;
    content: string | null;
    weatherCondition: string | null;
    specialNotes: string | null;
  },
) {
  const db = drizzle(c.env.DB);
  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig) return;
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const result = await analyzeTbmRecord(aiConfig, {
          topic: tbm.topic,
          content: tbm.content,
          weatherCondition: tbm.weatherCondition,
          specialNotes: tbm.specialNotes,
        });
        if (result)
          await db
            .update(tbmRecords)
            .set({
              aiAnalysis: JSON.stringify(result),
              aiAnalyzedAt: new Date().toISOString(),
            })
            .where(eq(tbmRecords.id, tbm.id));
      } catch (e) {
        logger.error(
          "TBM AI analysis failed",
          e instanceof Error ? e : undefined,
        );
      }
    })(),
  );
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const result = await generateTbmMeetingMinutes(aiConfig, {
          topic: tbm.topic,
          content: tbm.content,
          weatherCondition: tbm.weatherCondition,
          specialNotes: tbm.specialNotes,
        });
        if (result)
          await db
            .update(tbmRecords)
            .set({
              aiMeetingMinutes: JSON.stringify(result),
              aiMinutesGeneratedAt: new Date().toISOString(),
            })
            .where(eq(tbmRecords.id, tbm.id));
      } catch (e) {
        logger.error(
          "TBM meeting minutes generation failed:",
          e instanceof Error ? e : undefined,
        );
      }
    })(),
  );
}
