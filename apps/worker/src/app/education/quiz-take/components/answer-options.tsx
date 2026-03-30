"use client";

import { CheckCircle2 } from "lucide-react";
import type { AnswerValue, QuestionType } from "../utils";

interface AnswerOptionsProps {
  questionType: QuestionType;
  options: string[];
  answer?: AnswerValue;
  questionId: string;
  index: number;
  onAnswerSelect: (questionId: string, optionIndex: number) => void;
  onMultiChoiceToggle: (questionId: string, optionIndex: number) => void;
  onShortAnswerChange: (questionId: string, value: string) => void;
}

export function AnswerOptions({
  questionType,
  options,
  answer,
  questionId,
  index,
  onAnswerSelect,
  onMultiChoiceToggle,
  onShortAnswerChange,
}: AnswerOptionsProps) {
  if (questionType === "IMAGE") {
    // IMAGE type uses same rendering as SINGLE_CHOICE
    return (
      <div className="space-y-2">
        {options.map((option: string, optIdx: number) => {
          const selected = answer === optIdx;
          return (
            <button
              type="button"
              key={`${questionId}-single-${optIdx}`}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => onAnswerSelect(questionId, optIdx)}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selected ? "border-primary" : "border-border"
                }`}
              >
                {selected && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm flex-1 break-words">{option}</span>
              {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === "SINGLE_CHOICE") {
    return (
      <div className="space-y-2">
        {options.map((option: string, optIdx: number) => {
          const selected = answer === optIdx;
          return (
            <button
              type="button"
              key={`${questionId}-single-${optIdx}`}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => onAnswerSelect(questionId, optIdx)}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selected ? "border-primary" : "border-border"
                }`}
              >
                {selected && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm flex-1 break-words">{option}</span>
              {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === "OX") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`rounded-lg border px-4 py-6 text-xl font-bold transition-colors ${
            answer === 0
              ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
              : "border-border hover:bg-muted"
          }`}
          onClick={() => onAnswerSelect(questionId, 0)}
        >
          ⭕ O
        </button>
        <button
          type="button"
          className={`rounded-lg border px-4 py-6 text-xl font-bold transition-colors ${
            answer === 1
              ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
              : "border-border hover:bg-muted"
          }`}
          onClick={() => onAnswerSelect(questionId, 1)}
        >
          ❌ X
        </button>
      </div>
    );
  }

  if (questionType === "MULTI_CHOICE") {
    return (
      <div className="space-y-2">
        {options.map((option: string, optIdx: number) => {
          const selected = Array.isArray(answer) && answer.includes(optIdx);
          return (
            <button
              type="button"
              key={`${questionId}-multi-${optIdx}`}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => onMultiChoiceToggle(questionId, optIdx)}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center ${
                  selected ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {selected && (
                  <div className="w-2 h-2 rounded-sm bg-background" />
                )}
              </div>
              <span className="text-sm flex-1 break-words">{option}</span>
              {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === "SHORT_ANSWER") {
    return (
      <input
        type="text"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="정답을 입력해 주세요"
        value={typeof answer === "string" ? answer : ""}
        onChange={(event) =>
          onShortAnswerChange(questionId, event.target.value)
        }
      />
    );
  }

  return null;
}
