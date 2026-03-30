"use client";

import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@safetywallet/ui";
import { riskOptions } from "../constants";
import { RiskLevel } from "@safetywallet/types";

interface RiskLevelSelectorProps {
  value: RiskLevel | null;
  onChange: (level: RiskLevel) => void;
}

export function RiskLevelSelector({ value, onChange }: RiskLevelSelectorProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("common.info")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {riskOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-2 px-4 rounded-lg border-2 text-center transition-colors ${
                value === opt.value ? "border-current" : "border-border"
              } ${opt.color}`}
            >
              {t(opt.label)}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
