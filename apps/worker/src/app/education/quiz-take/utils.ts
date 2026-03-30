export type QuestionType =
  | "SINGLE_CHOICE"
  | "OX"
  | "MULTI_CHOICE"
  | "SHORT_ANSWER"
  | "IMAGE";

export type AnswerValue = number | number[] | string;

export const getQuestionType = (value: string | undefined): QuestionType => {
  if (
    value === "SINGLE_CHOICE" ||
    value === "OX" ||
    value === "MULTI_CHOICE" ||
    value === "SHORT_ANSWER" ||
    value === "IMAGE"
  ) {
    return value;
  }
  return "SINGLE_CHOICE";
};

export const getQuestionTypeLabel = (type: QuestionType): string => {
  if (type === "OX") return "OX 퀴즈";
  if (type === "MULTI_CHOICE") return "복수 선택";
  if (type === "SHORT_ANSWER") return "주관식";
  if (type === "IMAGE") return "이미지 문제";
  return "단일 선택";
};

export const parseQuestionOptions = (
  options: string | string[] | undefined,
): string[] => {
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const formatAnswerValue = (
  questionType: QuestionType,
  options: string[],
  value: AnswerValue | undefined,
  noAnswerLabel: string,
): string => {
  if (questionType === "SHORT_ANSWER") {
    return typeof value === "string" && value.trim().length > 0
      ? value
      : noAnswerLabel;
  }

  if (questionType === "MULTI_CHOICE") {
    if (!Array.isArray(value) || value.length === 0) {
      return noAnswerLabel;
    }

    const selectedOptions = value
      .map((optionIndex) => options[optionIndex])
      .filter(Boolean);
    return selectedOptions.length > 0
      ? selectedOptions.join(", ")
      : noAnswerLabel;
  }

  if (typeof value !== "number") {
    return noAnswerLabel;
  }

  if (questionType === "OX") {
    return value === 0 ? "O" : value === 1 ? "X" : noAnswerLabel;
  }

  return options[value] ?? noAnswerLabel;
};
