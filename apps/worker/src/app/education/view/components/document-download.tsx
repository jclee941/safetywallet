import { Download } from "lucide-react";
import { Button } from "@safetywallet/ui";
import { useTranslation } from "@/hooks/use-translation";

interface DocumentDownloadProps {
  contentUrl: string;
}

export function DocumentDownload({ contentUrl }: DocumentDownloadProps) {
  const t = useTranslation();

  return (
    <Button
      className="w-full gap-2"
      variant="outline"
      onClick={() => window.open(contentUrl, "_blank")}
    >
      <Download className="w-4 h-4" />
      {t("education.documentDownload")}
    </Button>
  );
}
