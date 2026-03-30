"use client";

import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@safetywallet/ui";
import { hazardSubcategoryOptions } from "../constants";
import type { HazardSubcategory } from "@safetywallet/types";

interface HazardSubcategorySelectorProps {
  value: HazardSubcategory | null;
  onChange: (subcategory: HazardSubcategory) => void;
}

export function HazardSubcategorySelector({
  value,
  onChange,
}: HazardSubcategorySelectorProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("posts.new.hazardSubcategory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {hazardSubcategoryOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`p-3 rounded-lg border text-center transition-colors ${
                value === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border"
              }`}
            >
              <div className="text-xs">{t(opt.label)}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
