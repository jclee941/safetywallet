import { useEffect } from "react";
import { PenLine } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  useToast,
} from "@safetywallet/ui";
import { useTranslation } from "@/hooks/use-translation";
import { useSignatureCanvas } from "../hooks/use-signature-canvas";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (signatureDataUrl: string) => void;
  isSubmitting: boolean;
}

export function SignatureDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: SignatureDialogProps) {
  const t = useTranslation();
  const { toast } = useToast();
  const {
    canvasRef,
    canvasProps,
    hasStroke,
    clearSignature,
    getCanvasDataUrl,
  } = useSignatureCanvas();

  useEffect(() => {
    if (open) {
      clearSignature();
    }
  }, [open, clearSignature]);

  const handleSubmit = () => {
    if (!hasStroke) {
      toast({
        title: t("education.signature.needStroke"),
        variant: "destructive",
      });
      return;
    }
    const dataUrl = getCanvasDataUrl();
    if (dataUrl) {
      onSubmit(dataUrl);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <PenLine className="w-4 h-4 inline mr-2" />
            {t("education.signature.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("education.signature.modalHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-background">
          <canvas ref={canvasRef} {...canvasProps} />
        </div>
        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex gap-2">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
            </AlertDialogCancel>
            <Button variant="outline" onClick={clearSignature}>
              {t("education.signature.clear")}
            </Button>
          </div>
          <AlertDialogAction asChild>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting
                ? t("education.signature.submitting")
                : t("education.signature.submit")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
