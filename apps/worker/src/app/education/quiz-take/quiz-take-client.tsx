"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useQuiz,
  useSubmitQuizAttempt,
  useMyQuizAttempts,
} from "@/hooks/use-api";
import { useTranslation } from "@/hooks/use-translation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Badge, Button, useToast } from "@safetywallet/ui";
import { LucideAlertCircle, LucideClock } from "lucide-react";
import { getQuestionType, type AnswerValue } from "./utils";
import { LoadingState } from "./components/loading-state";
import { QuizQuestionCard } from "./components/quiz-question-card";
import { QuizResultCard } from "./components/quiz-result-card";

interface QuizTakeClientProps {
  quizId: string;
}

export function QuizTakeClient({ quizId }: QuizTakeClientProps) {
  const router = useRouter();
  const t = useTranslation();
  const { data: quiz, isLoading: isQuizLoading } = useQuiz(quizId);
  const { data: attempts, isLoading: isAttemptsLoading } =
    useMyQuizAttempts(quizId);
  const { mutate: submitAttempt, isPending: isSubmitting } =
    useSubmitQuizAttempt();
  const { toast } = useToast();

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{
    score: number;
    passed: boolean;
    answers?: AnswerValue[] | null;
  } | null>(null);

  // If there is a prior attempt, show the latest result and prefill answers
  useEffect(() => {
    if (quiz && attempts && attempts.length > 0) {
      const [latestAttempt] = attempts;
      setShowResult(true);
      setLastResult({
        score: latestAttempt.score,
        passed: latestAttempt.passed,
        answers: latestAttempt.answers ?? null,
      });

      if (latestAttempt.answers?.length) {
        const restoredAnswers: Record<string, AnswerValue> = {};
        quiz.questions.forEach((question, index) => {
          restoredAnswers[question.id] = latestAttempt.answers?.[index] ?? "";
        });
        setAnswers(restoredAnswers);
      }
    }
  }, [attempts, quiz]);

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleMultiChoiceToggle = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => {
      const existing = prev[questionId];
      const current = Array.isArray(existing) ? existing : [];
      const hasValue = current.includes(optionIndex);
      return {
        ...prev,
        [questionId]: hasValue
          ? current.filter((value) => value !== optionIndex)
          : [...current, optionIndex],
      };
    });
  };

  const handleShortAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    if (!quiz) return;

    const hasUnanswered = quiz.questions.some((question) => {
      const questionType = getQuestionType(question.questionType);
      const answer = answers[question.id];

      if (questionType === "MULTI_CHOICE") {
        return !Array.isArray(answer) || answer.length === 0;
      }

      if (questionType === "SHORT_ANSWER") {
        return typeof answer !== "string" || answer.trim().length === 0;
      }

      return typeof answer !== "number";
    });

    if (hasUnanswered) {
      toast({
        title: t("education.quiz.selectAllAnswers"),
        variant: "destructive",
      });
      return;
    }

    submitAttempt(
      {
        quizId,
        answers,
        questionOrder: quiz.questions.map((question) => question.id),
      },
      {
        onSuccess: (data) => {
          setLastResult({
            score: data.attempt.score,
            passed: data.attempt.passed,
            answers: data.attempt.answers ?? null,
          });
          setShowResult(true);
          if (data.attempt.answers?.length) {
            const restoredAnswers: Record<string, AnswerValue> = {};
            quiz.questions.forEach((question, index) => {
              restoredAnswers[question.id] =
                data.attempt.answers?.[index] ?? answers[question.id] ?? "";
            });
            setAnswers(restoredAnswers);
          }
          toast({
            title: data.attempt.passed
              ? t("education.quiz.status.pass")
              : t("education.quiz.status.fail"),
            description: t("education.quiz.scoreDisplay").replace(
              "${score}",
              String(data.attempt.score),
            ),
            variant: data.attempt.passed ? "default" : "destructive",
          });
        },
        onError: () => {
          toast({
            title: t("education.quiz.submitError"),
            variant: "destructive",
          });
        },
      },
    );
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResult(false);
    setLastResult(null);
  };

  if (isQuizLoading || isAttemptsLoading) {
    return <LoadingState />;
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-muted pb-nav">
        <Header />
        <main className="p-4 text-center py-12">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-muted-foreground">
            {t("education.quiz.quizNotFound")}
          </p>
          <Button className="mt-4" onClick={() => router.back()}>
            {t("common.back")}
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (showResult && lastResult) {
    return (
      <div className="min-h-screen bg-muted pb-nav">
        <Header />
        <QuizResultCard
          score={lastResult.score}
          passed={lastResult.passed}
          answers={lastResult.answers}
          questions={quiz.questions}
          onReset={resetQuiz}
        />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />

      <main className="p-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold break-words">{quiz.title}</h1>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <LucideAlertCircle className="w-3 h-3" />;
              {t("education.quiz.maximumLabel")} {quiz.maxAttempts}
              {t("education.attempts")}
            </Badge>
            {quiz.timeLimitMinutes && (
              <Badge variant="outline" className="gap-1">
                <LucideClock className="w-3 h-3" />;{quiz.timeLimitMinutes}
                {t("education.minutes")}
              </Badge>
            )}
          </div>
          {quiz.description && (
            <p className="text-sm text-muted-foreground break-words">
              {quiz.description}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <QuizQuestionCard
              key={q.id}
              question={q}
              index={idx}
              answer={answers[q.id]}
              onAnswerSelect={handleAnswerSelect}
              onMultiChoiceToggle={handleMultiChoiceToggle}
              onShortAnswerChange={handleShortAnswerChange}
            />
          ))}
        </div>

        <Button
          className="w-full py-6 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? t("education.quiz.submitting")
            : t("education.quiz.submitButton")}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
