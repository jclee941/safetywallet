import { z } from "zod";
import {
  EducationContentType,
  QuizStatus,
  StatutoryTrainingType,
  TrainingCompletionStatus,
  TbmTopicCategory,
  uuid,
  isoDateStr,
  nonEmptyStr,
} from "./shared.js";

export const CreateCourseSchema = z.object({
  siteId: uuid,
  title: nonEmptyStr,
  description: z.string().optional(),
  contentType: z.enum(EducationContentType),
  contentUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  externalSource: z.enum(["LOCAL", "YOUTUBE", "KOSHA"] as const).optional(),
  externalId: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export const SubmitQuizSchema = z.object({
  quizId: uuid,
  siteId: uuid,
  answers: z.array(
    z.union([z.number().int(), z.array(z.number().int()), z.string()]),
  ),
  startedAt: isoDateStr,
  clientAttemptId: z.string().uuid().optional(),
});

export const UpdateStatutoryTrainingSchema = z.object({
  trainingType: z.enum(StatutoryTrainingType).optional(),
  trainingName: nonEmptyStr.optional(),
  trainingDate: isoDateStr.optional(),
  expirationDate: isoDateStr.optional(),
  provider: z.string().optional(),
  certificateUrl: z.string().optional(),
  hoursCompleted: z.number().nonnegative().optional(),
  status: z.enum(TrainingCompletionStatus).optional(),
  notes: z.string().optional(),
});

export const AttendTbmSchema = z.object({
  tbmRecordId: uuid,
});

export const CreateQuizInputSchema = z.object({
  siteId: uuid,
  contentId: uuid.optional(),
  title: nonEmptyStr,
  description: z.string().optional(),
  status: z.enum(QuizStatus).optional(),
  pointsReward: z.number().int().optional(),
  timeLimitMinutes: z.number().int().optional(),
});

export const CreateStatutoryTrainingInputSchema = z.object({
  siteId: uuid,
  userId: uuid,
  trainingType: z.enum(StatutoryTrainingType),
  trainingName: nonEmptyStr,
  trainingDate: isoDateStr,
  expirationDate: isoDateStr.optional(),
  provider: z.string().optional(),
  certificateUrl: z.string().optional(),
  hoursCompleted: z.number().nonnegative().optional(),
  status: z.enum(TrainingCompletionStatus).optional(),
  notes: z.string().optional(),
});

export const CreateTbmInputSchema = z.object({
  siteId: uuid,
  date: isoDateStr,
  topic: nonEmptyStr,
  topicCategory: z.enum(TbmTopicCategory).optional(),
  content: z.string().optional(),
  leaderId: uuid.optional(),
  weatherCondition: z.string().optional(),
  specialNotes: z.string().optional(),
});

export const UpdateTbmInputSchema = z
  .object({
    date: isoDateStr.optional(),
    topic: nonEmptyStr.optional(),
    topicCategory: z.enum(TbmTopicCategory).optional(),
    content: z.string().optional(),
    weatherCondition: z.string().optional(),
    specialNotes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const TbmRecordFilterSchema = z.object({
  siteId: uuid,
  date: isoDateStr.optional(),
  topicCategory: z.enum(TbmTopicCategory).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
