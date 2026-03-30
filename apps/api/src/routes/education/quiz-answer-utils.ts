import { QUIZ_QUESTION_TYPES, type QuizQuestionType } from "./helpers";

export const parseMultiChoiceAnswers = (
  raw: string | null | undefined,
): number[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = Array.from(
      new Set(
        parsed.filter(
          (value) => Number.isInteger(value) && value >= 0,
        ) as number[],
      ),
    ).sort((a, b) => a - b);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

export const normalizeTextAnswer = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

export const isQuizAnswerCorrect = (
  question: {
    correctAnswer: number;
    questionType: string;
    correctAnswerText: string | null;
  },
  answer: number | number[] | string | undefined,
): boolean => {
  const questionType = QUIZ_QUESTION_TYPES.includes(
    question.questionType as QuizQuestionType,
  )
    ? (question.questionType as QuizQuestionType)
    : "SINGLE_CHOICE";

  if (
    questionType === "SINGLE_CHOICE" ||
    questionType === "OX" ||
    questionType === "IMAGE"
  ) {
    return typeof answer === "number" && answer === question.correctAnswer;
  }

  if (questionType === "MULTI_CHOICE") {
    if (!Array.isArray(answer)) return false;
    const submitted = Array.from(
      new Set(answer.filter((value) => Number.isInteger(value) && value >= 0)),
    ).sort((a, b) => a - b);
    const expected = parseMultiChoiceAnswers(question.correctAnswerText);
    if (!expected) return false;
    return (
      submitted.length === expected.length &&
      submitted.every((value, index) => value === expected[index])
    );
  }

  if (questionType === "SHORT_ANSWER") {
    if (typeof answer !== "string") return false;
    return (
      normalizeTextAnswer(answer) ===
      normalizeTextAnswer(question.correctAnswerText)
    );
  }

  return false;
};
