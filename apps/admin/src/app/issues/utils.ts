import type { IssueTemplate } from "./issue-template";

export function getDefaultFieldValues(
  template: IssueTemplate,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    if (field.type === "dropdown" && field.options?.length) {
      values[field.id] = field.options[0];
    } else {
      values[field.id] = "";
    }
  }
  return values;
}
