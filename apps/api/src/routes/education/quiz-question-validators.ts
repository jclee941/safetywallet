import { z } from "zod";
import type {
  CreateQuizQuestionBody,
  UpdateQuizQuestionBody,
  QuizQuestionType,
} from "./helpers";
import { QUIZ_QUESTION_TYPES } from "./helpers";
import { parseMultiChoiceAnswers } from "./quiz-answer-utils";

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

export interface ExistingQuizQuestionForUpdate {
  questionType: string;
  options: string[];
  correctAnswer: number;
  correctAnswerText: string | null;
  imageUrl: string | null;
}

export interface QuizQuestionValidationError {
  ok: false;
  code:
    | "INVALID_QUESTION_TYPE"
    | "INVALID_OPTIONS"
    | "INVALID_CORRECT_ANSWER"
    | "INVALID_CORRECT_ANSWER_TEXT"
    | "INVALID_IMAGE_URL";
  message: string;
}

export interface QuizQuestionValidationSuccess {
  ok: true;
  data: {
    questionType: QuizQuestionType;
    options: string[];
    correctAnswer: number;
    correctAnswerText: string | null;
    imageUrl: string | null;
  };
}

export type QuizQuestionValidationResult =
  | QuizQuestionValidationError
  | QuizQuestionValidationSuccess;

const isValidImageUrl = (value: string): boolean => {
  if (value.startsWith("/r2/")) {
    return value.length > 4;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const validateQuestionType = (
  questionType: QuizQuestionType,
): QuizQuestionValidationError | null => {
  if (!QUIZ_QUESTION_TYPES.includes(questionType)) {
    return {
      ok: false,
      code: "INVALID_QUESTION_TYPE",
      message: "Invalid questionType",
    };
  }

  return null;
};

export const validateCreateQuizQuestion = (
  body: CreateQuizQuestionBody,
): QuizQuestionValidationResult => {
  const questionType = (body.questionType ??
    "SINGLE_CHOICE") as QuizQuestionType;
  const questionTypeError = validateQuestionType(questionType);
  if (questionTypeError) return questionTypeError;

  let options: string[] = Array.isArray(body.options)
    ? body.options.filter((option) => option.trim().length > 0)
    : [];
  let correctAnswer = body.correctAnswer;
  let correctAnswerText = body.correctAnswerText?.trim() || null;
  let imageUrl = body.imageUrl?.trim() || null;

  if (questionType === "OX") {
    options = ["O", "X"];
    if (
      typeof correctAnswer !== "number" ||
      !Number.isInteger(correctAnswer) ||
      (correctAnswer !== 0 && correctAnswer !== 1)
    ) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER",
        message: "correctAnswer must be 0 (O) or 1 (X)",
      };
    }
    correctAnswerText = null;
    imageUrl = null;
  }

  if (questionType === "SINGLE_CHOICE" || questionType === "IMAGE") {
    if (options.length < 2) {
      return {
        ok: false,
        code: "INVALID_OPTIONS",
        message: "options must have at least 2 items",
      };
    }
    if (
      typeof correctAnswer !== "number" ||
      !Number.isInteger(correctAnswer) ||
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER",
        message: "correctAnswer must be a valid option index",
      };
    }
    correctAnswerText = null;

    if (questionType === "IMAGE") {
      if (!imageUrl) {
        return {
          ok: false,
          code: "INVALID_IMAGE_URL",
          message: "imageUrl is required for IMAGE",
        };
      }
      if (!isValidImageUrl(imageUrl)) {
        return {
          ok: false,
          code: "INVALID_IMAGE_URL",
          message: "imageUrl must be a valid URL or /r2/ path",
        };
      }
    } else {
      imageUrl = null;
    }
  }

  if (questionType === "MULTI_CHOICE") {
    if (options.length < 2) {
      return {
        ok: false,
        code: "INVALID_OPTIONS",
        message: "options must have at least 2 items",
      };
    }
    const parsedAnswers = parseMultiChoiceAnswers(correctAnswerText);
    if (!parsedAnswers) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText must be a JSON array of indices",
      };
    }
    const hasOutOfRange = parsedAnswers.some(
      (index) => index >= options.length,
    );
    if (hasOutOfRange) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText contains out-of-range indices",
      };
    }
    correctAnswer = parsedAnswers[0];
    correctAnswerText = JSON.stringify(parsedAnswers);
    imageUrl = null;
  }

  if (questionType === "SHORT_ANSWER") {
    if (!correctAnswerText) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText is required for SHORT_ANSWER",
      };
    }
    options = [];
    correctAnswer = 0;
    correctAnswerText = correctAnswerText.trim();
    imageUrl = null;
  }

  return {
    ok: true,
    data: {
      questionType,
      options,
      correctAnswer: correctAnswer ?? 0,
      correctAnswerText,
      imageUrl,
    },
  };
};

export const validateUpdateQuizQuestion = (
  body: UpdateQuizQuestionBody,
  existingQuestion: ExistingQuizQuestionForUpdate,
): QuizQuestionValidationResult => {
  const questionType = (body.questionType ??
    existingQuestion.questionType) as QuizQuestionType;
  const questionTypeError = validateQuestionType(questionType);
  if (questionTypeError) return questionTypeError;

  let options = body.options ?? existingQuestion.options;
  options = Array.isArray(options)
    ? options.filter((option) => option.trim().length > 0)
    : [];

  let correctAnswer = body.correctAnswer ?? existingQuestion.correctAnswer;
  let correctAnswerText =
    body.correctAnswerText !== undefined
      ? body.correctAnswerText?.trim() || null
      : existingQuestion.correctAnswerText;
  let imageUrl =
    body.imageUrl !== undefined
      ? body.imageUrl?.trim() || null
      : existingQuestion.imageUrl;

  if (questionType === "OX") {
    options = ["O", "X"];
    if (
      !Number.isInteger(correctAnswer) ||
      (correctAnswer !== 0 && correctAnswer !== 1)
    ) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER",
        message: "correctAnswer must be 0 (O) or 1 (X)",
      };
    }
    correctAnswerText = null;
    imageUrl = null;
  }

  if (questionType === "SINGLE_CHOICE" || questionType === "IMAGE") {
    if (options.length < 2) {
      return {
        ok: false,
        code: "INVALID_OPTIONS",
        message: "options must have at least 2 items",
      };
    }
    if (
      !Number.isInteger(correctAnswer) ||
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER",
        message: "correctAnswer must be a valid option index",
      };
    }
    correctAnswerText = null;

    if (questionType === "IMAGE") {
      if (!imageUrl) {
        return {
          ok: false,
          code: "INVALID_IMAGE_URL",
          message: "imageUrl is required for IMAGE",
        };
      }
      if (!isValidImageUrl(imageUrl)) {
        return {
          ok: false,
          code: "INVALID_IMAGE_URL",
          message: "imageUrl must be a valid URL or /r2/ path",
        };
      }
    } else {
      imageUrl = null;
    }
  }

  if (questionType === "MULTI_CHOICE") {
    if (options.length < 2) {
      return {
        ok: false,
        code: "INVALID_OPTIONS",
        message: "options must have at least 2 items",
      };
    }
    const parsedAnswers = parseMultiChoiceAnswers(correctAnswerText);
    if (!parsedAnswers) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText must be a JSON array of indices",
      };
    }
    const hasOutOfRange = parsedAnswers.some(
      (index) => index >= options.length,
    );
    if (hasOutOfRange) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText contains out-of-range indices",
      };
    }
    correctAnswer = parsedAnswers[0];
    correctAnswerText = JSON.stringify(parsedAnswers);
    imageUrl = null;
  }

  if (questionType === "SHORT_ANSWER") {
    if (!correctAnswerText) {
      return {
        ok: false,
        code: "INVALID_CORRECT_ANSWER_TEXT",
        message: "correctAnswerText is required for SHORT_ANSWER",
      };
    }
    options = [];
    correctAnswer = 0;
    correctAnswerText = correctAnswerText.trim();
    imageUrl = null;
  }

  return {
    ok: true,
    data: {
      questionType,
      options,
      correctAnswer,
      correctAnswerText,
      imageUrl,
    },
  };
};
