// === Education AI Analysis ===

export interface EducationAiAnalysisResult {
  category:
    | "safety_training"
    | "equipment_operation"
    | "emergency_response"
    | "hazard_awareness"
    | "ppe_usage"
    | "regulatory_compliance"
    | "health_wellness"
    | "general_safety";
  qualityLevel:
    | "excellent"
    | "good"
    | "adequate"
    | "needs_improvement"
    | "poor";
  summary: string;
  keyLearningPoints: string[];
  safetyRelevance: string;
  relatedStatutoryTraining: string[];
  improvements: string[];
  targetAudience: string;
  confidence: number;
  modelVersion: string;
}

export interface EducationAiAnalysisDto {
  analysis: EducationAiAnalysisResult | null;
  analyzedAt: string | null;
}

export interface TbmAiAnalysisResult {
  riskLevel: "high" | "medium" | "low";
  summary: string;
  identifiedRisks: string[];
  safetyChecklist: string[];
  precautions: string[];
  relatedRegulations: string[];
  confidence: number;
  modelVersion: string;
}

export interface TbmAiAnalysisDto {
  analysis: TbmAiAnalysisResult | null;
  analyzedAt: string | null;
}

export interface TbmMeetingMinutesResult {
  title: string;
  date: string;
  location: string;
  leader: string;
  attendeeCount: number;
  weatherCondition: string;
  agenda: string[];
  discussionPoints: string[];
  safetyInstructions: string[];
  riskAssessment: {
    level: string;
    keyRisks: string[];
  };
  actionItems: string[];
  conclusion: string;
  modelVersion: string;
}

export interface TbmMeetingMinutesDto {
  minutes: TbmMeetingMinutesResult | null;
  generatedAt: string | null;
}

export interface QuizGenerationQuestionDto {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  questionType: "SINGLE_CHOICE" | "OX";
}

export interface QuizGenerationDto {
  quizTitle: string;
  questions: QuizGenerationQuestionDto[];
}

export interface AnnouncementDraftDto {
  title: string;
  content: string;
}
