"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  useEducationCompletionStatus,
  useEducationContent,
  useSubmitEducationCompletion,
} from "@/hooks/use-api";
import { useTranslation } from "@/hooks/use-translation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useToast,
} from "@safetywallet/ui";
import { Video, Download, Calendar, PenLine, CheckCircle2 } from "lucide-react";

function LoadingState() {
  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />
      <main className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
      <BottomNav />
    </div>
  );
}

function toYouTubeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
    const isYouTube = host === "youtube.com" || host === "youtube-nocookie.com";
    let videoId: string | null = null;

    if (isYouTube) {
      videoId =
        parsed.searchParams.get("v") ||
        parsed.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/)?.[2] ||
        null;
    } else if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1).split(/[/?#]/)[0] || null;
    }

    if (videoId) {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`;
    }
  } catch {
    // not a valid URL — fall through
  }
  return url;
}

function toYouTubeWatchUrl(url: string): string | null {
  const embedUrl = toYouTubeEmbedUrl(url);
  const match = embedUrl.match(/\/embed\/([^/?#]+)/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

function EducationDetailContent() {
  const router = useRouter();
  const t = useTranslation();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { data, isLoading, error } = useEducationContent(id);
  const { data: completionData, isLoading: isCompletionLoading } =
    useEducationCompletionStatus(id);
  const { mutate: submitCompletion, isPending: isSubmitting } =
    useSubmitEducationCompletion();
  const { toast } = useToast();
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getContentTypeLabel = (contentType: string) => {
    const typeKey = `education.contentTypes.${contentType}` as const;
    return t(typeKey) || contentType;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasStroke(true);
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const handleSubmitSignature = () => {
    if (!id) return;
    if (!canvasRef.current) return;
    if (!hasStroke) {
      toast({
        title: t("education.signature.needStroke"),
        variant: "destructive",
      });
      return;
    }
    const dataUrl = canvasRef.current.toDataURL("image/png");
    submitCompletion(
      { contentId: id, signature: dataUrl },
      {
        onSuccess: () => {
          toast({ title: t("education.signature.toastSaved") });
          setSignatureOpen(false);
        },
        onError: () => {
          toast({
            title: t("education.signature.toastError"),
            variant: "destructive",
          });
        },
      },
    );
  };

  useEffect(() => {
    if (signatureOpen) {
      clearSignature();
    }
  }, [signatureOpen]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted pb-nav">
        <Header />
        <main className="p-4">
          <div className="text-center py-12">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-muted-foreground">{t("education.notFound")}</p>
            <Button className="mt-4" onClick={() => router.back()}>
              {t("common.back")}
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {getContentTypeLabel(data.contentType)}
          </Badge>
          {data.isRequired && (
            <Badge variant="destructive">
              {t("education.requiredEducation")}
            </Badge>
          )}
        </div>

        <h1 className="text-xl font-bold break-words">{data.title}</h1>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </div>

        {/* Content Type Specific Display */}
        {data.contentType === "VIDEO" &&
          (data.contentUrl || data.sourceUrl) &&
          (() => {
            const videoUrl = data.contentUrl || data.sourceUrl!;
            const embedUrl = toYouTubeEmbedUrl(videoUrl);
            const watchUrl = toYouTubeWatchUrl(videoUrl);
            return (
              <div className="space-y-2">
                <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    title={data.title}
                  />
                </div>
                {watchUrl && (
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    YouTube에서 보기
                  </a>
                )}
              </div>
            );
          })()}

        {data.contentType === "IMAGE" && data.contentUrl && (
          <div className="rounded-lg overflow-hidden border border-border">
            <Image
              src={data.contentUrl}
              alt={data.title}
              width={1200}
              height={800}
              className="w-full h-auto object-contain"
              unoptimized
            />
          </div>
        )}

        {data.description && (
          <Card>
            <CardContent className="p-4 bg-muted text-sm text-muted-foreground break-words">
              {data.description}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("education.details")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words">
              {data.content}
            </div>
          </CardContent>
        </Card>

        {data.contentType === "DOCUMENT" && data.contentUrl && (
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={() => window.open(data.contentUrl, "_blank")}
          >
            <Download className="w-4 h-4" />
            {t("education.documentDownload")}
          </Button>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              {t("education.signature.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("education.signature.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {completionData?.completion ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {t("education.signature.completedAt")}{" "}
                  {new Date(
                    completionData.completion.signedAt,
                  ).toLocaleString()}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("education.signature.notCompleted")}
              </p>
            )}

            {completionData?.completion?.signatureData && (
              <div className="rounded-md border bg-background p-2">
                <img
                  src={completionData.completion.signatureData}
                  alt={t("education.signature.previewAlt")}
                  className="w-full max-h-48 object-contain"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setSignatureOpen(true)}
                disabled={isCompletionLoading}
              >
                <PenLine className="w-4 h-4" />
                <span className="ml-1">
                  {completionData?.completion
                    ? t("education.signature.resign")
                    : t("education.signature.open")}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full mt-4"
          variant="secondary"
          onClick={() => router.back()}
        >
          {t("education.backToList")}
        </Button>
      </main>

      <AlertDialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("education.signature.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("education.signature.modalHint")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-background">
            <canvas
              ref={canvasRef}
              width={600}
              height={240}
              className="w-full bg-background"
              onPointerDown={startDrawing}
              onPointerMove={drawSignature}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
            />
          </div>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex gap-2">
              <AlertDialogCancel asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSignatureOpen(false)}
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
                onClick={handleSubmitSignature}
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

      <BottomNav />
    </div>
  );
}

export default function EducationViewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EducationDetailContent />
    </Suspense>
  );
}
