"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuizTakeClient } from "./quiz-take-client";
import { LoadingState } from "./components/loading-state";

function QuizTakePageContent() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get("id") || "";

  return <QuizTakeClient quizId={quizId} />;
}

export default function QuizTakePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <QuizTakePageContent />
    </Suspense>
  );
}
