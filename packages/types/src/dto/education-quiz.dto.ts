import { QuizStatus, QuestionType } from "../enums";

// === Quiz ===

export interface CreateQuizDto {
  siteId: string;
  contentId?: string;
  title: string;
  description?: string;
  status?: QuizStatus;
  pointsReward?: number;
  timeLimitMinutes?: number;
}

export interface UpdateQuizDto {
  title?: string;
  description?: string;
  status?: QuizStatus;
  pointsReward?: number;
  timeLimitMinutes?: number;
  contentId?: string;
}

export interface QuizDto {
  id: string;
  siteId: string;
  contentId: string | null;
  title: string;
  description: string | null;
  status: QuizStatus;
  passScore: number;
  pointsReward: number;
  timeLimitSec: number | null;
  questions: QuizQuestionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionDto {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface QuizListDto {
  id: string;
  title: string;
  status: QuizStatus;
  passScore: number;
  pointsReward: number;
  questionCount: number;
  attemptCount: number;
  createdAt: string;
}

// === Quiz Attempt ===

export interface SubmitQuizAttemptDto {
  quizId: string;
  siteId: string;
  answers: (number | number[] | string)[];
  startedAt: string;
}

export interface QuizAttemptDto {
  id: string;
  quizId: string;
  userId: string;
  siteId: string;
  score: number;
  passed: boolean;
  answers: (number | number[] | string)[];
  startedAt: string;
  completedAt: string;
  quizTitle?: string;
  userName?: string;
}

export interface QuizAttemptFilterDto {
  siteId: string;
  quizId?: string;
  userId?: string;
  passed?: boolean;
  page?: number;
  limit?: number;
}
