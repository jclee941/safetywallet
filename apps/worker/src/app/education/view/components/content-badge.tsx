import { Badge } from "@safetywallet/ui";
import { useTranslation } from "@/hooks/use-translation";

interface ContentBadgeProps {
  contentType: string;
  isRequired: boolean;
}

export function ContentBadge({ contentType, isRequired }: ContentBadgeProps) {
  const t = useTranslation();
  const typeKey = `education.contentTypes.${contentType}` as const;
  const typeLabel = t(typeKey) || contentType;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">{typeLabel}</Badge>
      {isRequired && (
        <Badge variant="destructive">{t("education.requiredEducation")}</Badge>
      )}
    </div>
  );
}
