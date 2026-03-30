"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@safetywallet/ui";
import {
  getQuestionType,
  getQuestionTypeLabel,
  parseQuestionOptions,
  type AnswerValue,
  type QuestionType,
} from "../utils";
import { AnswerOptions } from "./answer-options";

interface Question {
  id: string;
  question: string;
  questionType?: string;
  options?: string | string[];
  imageUrl?: string | null;
}

interface QuizQuestionCardProps {
  question: Question;
  index: number;
  answer?: AnswerValue;
  onAnswerSelect: (questionId: string, optionIndex: number) => void;
  onMultiChoiceToggle: (questionId: string, optionIndex: number) => void;
  onShortAnswerChange: (questionId: string, value: string) => void;
}

export function QuizQuestionCard({
  question,
  index,
  answer,
  onAnswerSelect,
  onMultiChoiceToggle,
  onShortAnswerChange,
}: QuizQuestionCardProps) {
  const options = parseQuestionOptions(question.options);
  const questionType = getQuestionType(question.questionType);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex gap-2">
          <span className="text-primary">Q{index + 1}.</span>
          {question.question}
          <Badge variant="outline" className="ml-1">
            {getQuestionTypeLabel(questionType)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {questionType === "IMAGE" && question.imageUrl && (
          <div className="pb-2">
            <img
              src={question.imageUrl}
              alt={`문항 이미지 ${index + 1}`}
              className="w-full max-h-80 rounded-lg border object-contain bg-background"
              onError={(e) => {
                const el = e.currentTarget;
                el.onerror = null;
                el.style.display = "none";
                const p = el.parentElement;
                if (p) {
                  const d = document.createElement("div");
                  d.className =
                    "w-full h-40 rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground";
                  d.textContent = "이미지를 불러올 수 없습니다";
                  p.appendChild(d);
                }
              }}
            />
          </div>
        )}

        <AnswerOptions
          questionType={questionType}
          options={options}
          answer={answer}
          questionId={question.id}
          index={index}
          onAnswerSelect={onAnswerSelect}
          onMultiChoiceToggle={onMultiChoiceToggle}
          onShortAnswerChange={onShortAnswerChange}
        />
      </CardContent>
    </Card>
  );
}
