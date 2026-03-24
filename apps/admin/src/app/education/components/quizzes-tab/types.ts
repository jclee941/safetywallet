export type QuestionType =
  | "SINGLE_CHOICE"
  | "OX"
  | "MULTI_CHOICE"
  | "SHORT_ANSWER"
  | "IMAGE";

export interface MultiOption {
  id: string;
  value: string;
}
