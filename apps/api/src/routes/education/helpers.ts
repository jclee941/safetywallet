import { z } from "zod";
import type { Env, AuthContext } from "../../types";

export type AppType = { Bindings: Env; Variables: { auth: AuthContext } };

export interface CreateContentBody {
  siteId: string;
  title: string;
  description?: string;
  contentType: "VIDEO" | "IMAGE" | "TEXT" | "DOCUMENT";
  contentUrl?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  externalSource?: "LOCAL" | "YOUTUBE" | "KOSHA";
  externalId?: string;
  sourceUrl?: string;
  isActive?: boolean;
}

export interface CreateQuizBody {
  siteId: string;
  contentId?: string;
  title: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  pointsReward?: number;
  timeLimitMinutes?: number;
}

export interface CreateQuizQuestionBody {
  question?: string;
  options?: string[];
  correctAnswer?: number;
  questionType?:
    | "SINGLE_CHOICE"
    | "OX"
    | "MULTI_CHOICE"
    | "SHORT_ANSWER"
    | "IMAGE";
  imageUrl?: string;
  correctAnswerText?: string;
  explanation?: string;
  orderIndex?: number;
}

export interface UpdateQuizQuestionBody {
  question?: string;
  options?: string[];
  correctAnswer?: number;
  questionType?:
    | "SINGLE_CHOICE"
    | "OX"
    | "MULTI_CHOICE"
    | "SHORT_ANSWER"
    | "IMAGE";
  imageUrl?: string;
  correctAnswerText?: string;
  explanation?: string;
  orderIndex?: number;
}

export interface SubmitQuizAttemptBody {
  answers?:
    | Array<number | number[] | string>
    | Record<string, number | number[] | string>;
  clientAttemptId?: string;
}

export type QuizQuestionType =
  | "SINGLE_CHOICE"
  | "OX"
  | "MULTI_CHOICE"
  | "SHORT_ANSWER"
  | "IMAGE";

export const QUIZ_QUESTION_TYPES: QuizQuestionType[] = [
  "SINGLE_CHOICE",
  "OX",
  "MULTI_CHOICE",
  "SHORT_ANSWER",
  "IMAGE",
];

export const CreateQuizQuestionRequestSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.number().int().optional(),
  questionType: z
    .enum(["SINGLE_CHOICE", "OX", "MULTI_CHOICE", "SHORT_ANSWER", "IMAGE"])
    .default("SINGLE_CHOICE"),
  imageUrl: z.string().optional(),
  correctAnswerText: z.string().optional(),
  explanation: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

export const UpdateQuizQuestionRequestSchema = z.object({
  question: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.number().int().optional(),
  questionType: z
    .enum(["SINGLE_CHOICE", "OX", "MULTI_CHOICE", "SHORT_ANSWER", "IMAGE"])
    .optional(),
  imageUrl: z.string().optional(),
  correctAnswerText: z.string().optional(),
  explanation: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

export const SubmitQuizAttemptRequestSchema = z.object({
  answers: z.union([
    z.array(z.union([z.number().int(), z.array(z.number().int()), z.string()])),
    z.record(
      z.union([z.number().int(), z.array(z.number().int()), z.string()]),
    ),
  ]),
  clientAttemptId: z.string().uuid().optional(),
});

export interface CreateStatutoryTrainingBody {
  siteId: string;
  userId: string;
  trainingType: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  trainingName: string;
  trainingDate: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  notes?: string;
}

export interface UpdateStatutoryTrainingBody {
  trainingType?: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK";
  trainingName?: string;
  trainingDate?: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: "SCHEDULED" | "COMPLETED" | "EXPIRED";
  notes?: string;
}

export interface CreateTbmBody {
  siteId: string;
  date: string;
  topic: string;
  content?: string;
  leaderId?: string;
  weatherCondition?: string;
  specialNotes?: string;
}
