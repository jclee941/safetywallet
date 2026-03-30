import { describe, expect, it } from "vitest";
import {
  parseMultiChoiceAnswers,
  normalizeTextAnswer,
  isQuizAnswerCorrect,
} from "../quiz-answer-utils";
import {
  validateCreateQuizQuestion,
  validateUpdateQuizQuestion,
} from "../quiz-question-validators";

describe("education/helpers", () => {
  describe("parseMultiChoiceAnswers", () => {
    it("returns normalized sorted unique indices", () => {
      expect(parseMultiChoiceAnswers("[2,1,1,0]")).toEqual([0, 1, 2]);
    });

    it("returns null for invalid JSON or non-array", () => {
      expect(parseMultiChoiceAnswers("not-json")).toBeNull();
      expect(parseMultiChoiceAnswers('{"a":1}')).toBeNull();
    });

    it("returns null when array has no valid integer index", () => {
      expect(parseMultiChoiceAnswers("[-1,2.3]")).toBeNull();
    });

    it("returns null for nullish input", () => {
      expect(parseMultiChoiceAnswers(null)).toBeNull();
      expect(parseMultiChoiceAnswers(undefined)).toBeNull();
    });
  });

  describe("normalizeTextAnswer", () => {
    it("normalizes to trimmed lower-case", () => {
      expect(normalizeTextAnswer("  HeLLo  ")).toBe("hello");
      expect(normalizeTextAnswer(null)).toBe("");
    });
  });

  describe("isQuizAnswerCorrect", () => {
    it("evaluates SINGLE_CHOICE and OX by numeric equality", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "SINGLE_CHOICE",
            correctAnswer: 1,
            correctAnswerText: null,
          },
          1,
        ),
      ).toBe(true);
      expect(
        isQuizAnswerCorrect(
          { questionType: "OX", correctAnswer: 0, correctAnswerText: null },
          1,
        ),
      ).toBe(false);
    });

    it("evaluates MULTI_CHOICE by set-equivalent indices", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "MULTI_CHOICE",
            correctAnswer: 0,
            correctAnswerText: "[0,2]",
          },
          [2, 0],
        ),
      ).toBe(true);
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "MULTI_CHOICE",
            correctAnswer: 0,
            correctAnswerText: "[0,2]",
          },
          [0, 1],
        ),
      ).toBe(false);
    });

    it("evaluates SHORT_ANSWER with normalized text", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "SHORT_ANSWER",
            correctAnswer: 0,
            correctAnswerText: "Correct Value",
          },
          " correct value ",
        ),
      ).toBe(true);
    });

    it("falls back to SINGLE_CHOICE behavior for unknown types", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "UNKNOWN",
            correctAnswer: 1,
            correctAnswerText: null,
          },
          1,
        ),
      ).toBe(true);
    });

    it("evaluates IMAGE with numeric answers only", () => {
      expect(
        isQuizAnswerCorrect(
          { questionType: "IMAGE", correctAnswer: 0, correctAnswerText: null },
          0,
        ),
      ).toBe(true);
      expect(
        isQuizAnswerCorrect(
          { questionType: "IMAGE", correctAnswer: 0, correctAnswerText: null },
          "0",
        ),
      ).toBe(false);
    });

    it("returns false when MULTI_CHOICE stored answer is invalid", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "MULTI_CHOICE",
            correctAnswer: 0,
            correctAnswerText: "not-json",
          },
          [0],
        ),
      ).toBe(false);
    });

    it("returns false when SHORT_ANSWER input is not a string", () => {
      expect(
        isQuizAnswerCorrect(
          {
            questionType: "SHORT_ANSWER",
            correctAnswer: 0,
            correctAnswerText: "answer",
          },
          0,
        ),
      ).toBe(false);
    });
  });

  describe("validateCreateQuizQuestion", () => {
    it("validates OX question", () => {
      const result = validateCreateQuizQuestion({
        question: "O or X?",
        questionType: "OX",
        correctAnswer: 1,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.options).toEqual(["O", "X"]);
      }
    });

    it("rejects SINGLE_CHOICE with too few options", () => {
      const result = validateCreateQuizQuestion({
        question: "Q",
        questionType: "SINGLE_CHOICE",
        options: ["A"],
        correctAnswer: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_OPTIONS");
      }
    });

    it("validates IMAGE question with /r2/ image url", () => {
      const result = validateCreateQuizQuestion({
        question: "image",
        questionType: "IMAGE",
        options: ["A", "B"],
        correctAnswer: 0,
        imageUrl: "/r2/example.jpg",
      });
      expect(result.ok).toBe(true);
    });

    it("validates IMAGE question with https image url", () => {
      const result = validateCreateQuizQuestion({
        question: "image",
        questionType: "IMAGE",
        options: ["A", "B"],
        correctAnswer: 0,
        imageUrl: "https://cdn.example.com/image.jpg",
      });
      expect(result.ok).toBe(true);
    });

    it("rejects IMAGE question with invalid image url", () => {
      const result = validateCreateQuizQuestion({
        question: "image",
        questionType: "IMAGE",
        options: ["A", "B"],
        correctAnswer: 0,
        imageUrl: "ftp://invalid.example.com/image.jpg",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_IMAGE_URL");
      }
    });

    it("rejects MULTI_CHOICE when answer indices are out of range", () => {
      const result = validateCreateQuizQuestion({
        question: "multi",
        questionType: "MULTI_CHOICE",
        options: ["A", "B"],
        correctAnswerText: "[0,2]",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER_TEXT");
      }
    });

    it("validates SHORT_ANSWER", () => {
      const result = validateCreateQuizQuestion({
        question: "short",
        questionType: "SHORT_ANSWER",
        correctAnswerText: "answer",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.correctAnswer).toBe(0);
      }
    });

    it("rejects SHORT_ANSWER without correctAnswerText", () => {
      const result = validateCreateQuizQuestion({
        question: "short",
        questionType: "SHORT_ANSWER",
        correctAnswerText: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER_TEXT");
        expect(result.message).toBe(
          "correctAnswerText is required for SHORT_ANSWER",
        );
      }
    });
  });

  describe("validateUpdateQuizQuestion", () => {
    const existing = {
      questionType: "SINGLE_CHOICE",
      options: ["A", "B", "C"],
      correctAnswer: 1,
      correctAnswerText: null,
      imageUrl: null,
    };

    it("validates update using existing values", () => {
      const result = validateUpdateQuizQuestion({}, existing);
      expect(result.ok).toBe(true);
    });

    it("rejects IMAGE update with invalid URL", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "IMAGE", imageUrl: "bad-url" },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_IMAGE_URL");
      }
    });

    it("rejects OX update when correctAnswer is out of range", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "OX", correctAnswer: 2 },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER");
      }
    });

    it("normalizes OX update by clearing text/image fields", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "OX",
          correctAnswer: 1,
          correctAnswerText: "[0,1]",
          imageUrl: "https://cdn.example.com/q.png",
        },
        {
          ...existing,
          questionType: "IMAGE",
          correctAnswerText: "legacy",
          imageUrl: "https://cdn.example.com/old.png",
        },
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.options).toEqual(["O", "X"]);
        expect(result.data.correctAnswerText).toBeNull();
        expect(result.data.imageUrl).toBeNull();
      }
    });

    it("normalizes SINGLE_CHOICE update by removing blank options", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "SINGLE_CHOICE",
          options: ["A", "", "B"],
          correctAnswer: 1,
        },
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.options).toEqual(["A", "B"]);
      }
    });

    it("validates MULTI_CHOICE update", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "MULTI_CHOICE",
          options: ["A", "B", "C"],
          correctAnswerText: "[0,2]",
        },
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.correctAnswerText).toBe("[0,2]");
      }
    });

    it("rejects SHORT_ANSWER update without answer text", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "SHORT_ANSWER", correctAnswerText: "" },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER_TEXT");
      }
    });

    it("rejects MULTI_CHOICE update with non-JSON correctAnswerText", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "MULTI_CHOICE",
          options: ["A", "B"],
          correctAnswerText: "not-json",
        },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER_TEXT");
        expect(result.message).toBe(
          "correctAnswerText must be a JSON array of indices",
        );
      }
    });

    it("rejects MULTI_CHOICE update with out-of-range indices", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "MULTI_CHOICE",
          options: ["A", "B"],
          correctAnswerText: "[0,5]",
        },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER_TEXT");
        expect(result.message).toBe(
          "correctAnswerText contains out-of-range indices",
        );
      }
    });

    it("validates SHORT_ANSWER update with valid answer text", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "SHORT_ANSWER", correctAnswerText: "  my answer  " },
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.options).toEqual([]);
        expect(result.data.correctAnswer).toBe(0);
        expect(result.data.correctAnswerText).toBe("my answer");
        expect(result.data.imageUrl).toBeNull();
      }
    });

    it("rejects SINGLE_CHOICE update with fewer than 2 options", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "SINGLE_CHOICE", options: ["Only one"] },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_OPTIONS");
        expect(result.message).toBe("options must have at least 2 items");
      }
    });

    it("rejects SINGLE_CHOICE update with out-of-range correctAnswer", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "SINGLE_CHOICE",
          options: ["A", "B"],
          correctAnswer: 5,
        },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_CORRECT_ANSWER");
        expect(result.message).toBe(
          "correctAnswer must be a valid option index",
        );
      }
    });

    it("rejects IMAGE update when imageUrl is missing", () => {
      const result = validateUpdateQuizQuestion(
        { questionType: "IMAGE", options: ["A", "B"], correctAnswer: 0 },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_IMAGE_URL");
        expect(result.message).toBe("imageUrl is required for IMAGE");
      }
    });

    it("rejects MULTI_CHOICE update with fewer than 2 options", () => {
      const result = validateUpdateQuizQuestion(
        {
          questionType: "MULTI_CHOICE",
          options: ["Only one"],
          correctAnswerText: "[0]",
        },
        existing,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INVALID_OPTIONS");
        expect(result.message).toBe("options must have at least 2 items");
      }
    });
  });
});
