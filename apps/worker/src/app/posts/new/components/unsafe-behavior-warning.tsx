"use client";

import { useTranslation } from "@/hooks/use-translation";

export function UnsafeBehaviorWarning() {
  const t = useTranslation();

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      <p className="font-medium">
        ⚠️ {t("posts.category.unsafeBehavior")} {t("common.info")}
      </p>
      <p>{t("posts.new.unsafeBehaviorWarning")}</p>
    </div>
  );
}
