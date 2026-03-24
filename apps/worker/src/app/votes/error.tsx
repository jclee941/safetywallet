"use client";

import { useTranslation } from "@/hooks/use-translation";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <p className="text-foreground mb-4">{t("common.errorOccurred")}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
