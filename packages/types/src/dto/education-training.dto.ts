import {
  StatutoryTrainingType,
  TrainingCompletionStatus,
  TbmTopicCategory,
} from "../enums";

// === Statutory Training ===

export interface CreateStatutoryTrainingDto {
  siteId: string;
  userId: string;
  trainingType: StatutoryTrainingType;
  trainingName: string;
  trainingDate: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: TrainingCompletionStatus;
  notes?: string;
}

export interface UpdateStatutoryTrainingDto {
  trainingType?: StatutoryTrainingType;
  trainingName?: string;
  trainingDate?: string;
  expirationDate?: string;
  provider?: string;
  certificateUrl?: string;
  hoursCompleted?: number;
  status?: TrainingCompletionStatus;
  notes?: string;
}

export interface StatutoryTrainingDto {
  id: string;
  siteId: string;
  userId: string;
  trainingType: StatutoryTrainingType;
  trainingName: string;
  trainingHours: number;
  scheduledDate: string;
  completedDate: string | null;
  expiryDate: string | null;
  status: TrainingCompletionStatus;
  certificateUrl: string | null;
  provider: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  creatorName?: string;
}

export interface StatutoryTrainingFilterDto {
  siteId: string;
  trainingType?: StatutoryTrainingType;
  status?: TrainingCompletionStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

// === TBM Record ===

export interface CreateTbmRecordDto {
  siteId: string;
  date: string;
  topic: string;
  content?: string;
  topicCategory?: TbmTopicCategory;
  leaderId?: string;
  weatherCondition?: string;
  specialNotes?: string;
}

export interface UpdateTbmRecordDto {
  date?: string;
  topic?: string;
  topicCategory?: TbmTopicCategory;
  content?: string;
  weatherCondition?: string;
  specialNotes?: string;
}

export interface TbmRecordDto {
  id: string;
  siteId: string;
  leaderId: string;
  date: string;
  topic: string;
  content: string | null;
  weatherCondition: string | null;
  specialNotes: string | null;
  attendeeCount: number;
  topicCategory: TbmTopicCategory | null;
  attendees: TbmAttendeeDto[];
  leaderName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TbmAttendeeDto {
  id: string;
  userId: string;
  userName?: string;
  signedAt: string;
}

export interface TbmRecordListDto {
  id: string;
  date: string;
  topic: string;
  leaderName: string | null;
  topicCategory: TbmTopicCategory | null;
  attendeeCount: number;
  createdAt: string;
}

export interface TbmRecordFilterDto {
  siteId: string;
  fromDate?: string;
  toDate?: string;
  leaderId?: string;
  topicCategory?: TbmTopicCategory;
  page?: number;
  limit?: number;
}
