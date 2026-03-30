"use client";

import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@safetywallet/ui";
import { categoryOptions } from "../constants";
import { Category } from "@safetywallet/types";

interface CategorySelectorProps {
  value: Category | null;
  onChange: (category: Category) => void;
  onClearSubcategory: () => void;
  onClearLocation: () => void;
}

export function CategorySelector({
  value,
  onChange,
  onClearSubcategory,
  onClearLocation,
}: CategorySelectorProps) {
  const t = useTranslation();

  const handleSelect = (cat: Category) => {
    onChange(cat);
    if (cat !== Category.HAZARD) {
      onClearSubcategory();
    }
    if (cat === Category.INCONVENIENCE) {
      onClearLocation();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("posts.selectCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {categoryOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`p-3 rounded-lg border text-center transition-colors ${
                value === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border"
              }`}
            >
              <div className="text-2xl mb-1">{opt.icon}</div>
              <div className="text-xs">{t(opt.label)}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
