"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@safetywallet/ui";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import {
  getQuestionType,
  getQuestionTypeLabel,
  parseQuestionOptions,
  formatAnswerValue,
  type AnswerValue,
  type QuestionType,
} from "../utils";

interface Question {
  id: string;
  question: string;
  questionType?: string;
  options?: string | string[];
  imageUrl?: string | null;
}

interface QuizResultCardProps {
  score: number;
  passed: boolean;
  answers?: AnswerValue[] | null;
  questions: Question[];
  onReset: () => void;
}

export function QuizResultCard({
  score,
  passed,
  answers,
  questions,
  onReset,
}: QuizResultCardProps) {
  const router = useRouter();
  const t = useTranslation();

  const statusLabel = passed
    ? t("education.quiz.status.pass")
    : t("education.quiz.status.fail");

  const hasAnswerReview = Array.isArray(answers) && answers.length > 0;

  return (
    <main className="p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-6xl mb-2">{passed ? "🎉" : "😢"}</div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          <Badge
            variant={passed ? "default" : "destructive"}
            className="px-4 py-2 text-base"
          >
            {statusLabel}
          </Badge>
        </h2>
        <p className="text-muted-foreground">
          {t("common.score")}{" "}
          <span className="font-bold text-primary text-xl">{score}</span>
          {t("education.quiz.scorePoints")}
        </p>
      </div>

      {hasAnswerReview && (
        <div className="w-full max-w-2xl space-y-3">
          <h3 className="text-lg font-semibold text-center">
            {t("education.quiz.answersHeading")}
          </h3>
          {questions.map((question, index) => {
            const options = parseQuestionOptions(question.options);
            const questionType = getQuestionType(question.questionType);
            const answerValue = answers?.[index];
            const answerText = formatAnswerValue(
              questionType,
              options,
              answerValue,
              t("education.quiz.noAnswer"),
            );
            return (
              <Card key={question.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="text-primary">Q{index + 1}.</span>
                    <span className="flex-1 break-words">
                      {question.question}
                    </span>
                    <Badge variant="outline" className="ml-1">
                      {getQuestionTypeLabel(questionType)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {questionType === "IMAGE" && question.imageUrl && (
                    <img
                      src={question.imageUrl}
                      alt={`문항 이미지 ${index + 1}`}
                      className="w-full max-h-64 rounded-md border object-contain bg-background"
                    />
                  )}
                  <span className="font-medium text-foreground">
                    {t("education.quiz.answerLabel")}
                  </span>{" "}
                  <span className="text-foreground">{answerText}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        {!passed && (
          <Button className="w-full gap-2" size="lg" onClick={onReset}>
            <RotateCcw className="w-4 h-4" />
            {t("education.retake")}
          </Button>
        )}
        <Button
          className="w-full"
          variant={passed ? "default" : "outline"}
          onClick={() => router.push("/education")}
        >
          {t("education.quiz.backToListButton")}
        </Button>
      </div>
    </main>
  );
}
