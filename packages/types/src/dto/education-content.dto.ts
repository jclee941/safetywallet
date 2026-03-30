import { EducationContentType, QuizStatus, QuestionType } from "../enums";

// === Education Content ===

export interface CreateEducationContentDto {
  siteId: string;
  title: string;
  description?: string;
  contentType: EducationContentType;
  contentUrl?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  externalSource?: "LOCAL" | "YOUTUBE" | "KOSHA";
  externalId?: string;
  sourceUrl?: string;
}

export interface EducationContentDto {
  id: string;
  siteId: string;
  title: string;
  description: string | null;
  contentType: EducationContentType;
  contentUrl: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  externalSource: "LOCAL" | "YOUTUBE" | "KOSHA";
  externalId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EducationContentListDto {
  id: string;
  title: string;
  contentType: EducationContentType;
  isActive: boolean;
  quizCount: number;
  viewCount: number;
  completionCount: number;
  createdAt: string;
}

export interface UpdateEducationContentDto {
  title?: string;
  description?: string;
  contentType?: EducationContentType;
  contentUrl?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  externalSource?: "LOCAL" | "YOUTUBE" | "KOSHA";
  externalId?: string;
  sourceUrl?: string;
}
