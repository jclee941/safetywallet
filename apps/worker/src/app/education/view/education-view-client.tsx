"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Calendar, PenLine, CheckCircle2 } from "lucide-react";
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
  Skeleton,
  Button,
  useToast,
} from "@safetywallet/ui";
import { ContentBadge } from "./components/content-badge";
import { VideoEmbed } from "./components/video-embed";
import { DocumentDownload } from "./components/document-download";
import { SignatureDialog } from "./components/signature-dialog";

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

function ErrorState() {
  const router = useRouter();
  const t = useTranslation();

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

export function EducationViewClient() {
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

  const handleSubmitSignature = (signatureDataUrl: string) => {
    if (!id) return;
    submitCompletion(
      { contentId: id, signature: signatureDataUrl },
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

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState />;
  }

  return (
    <div className="min-h-screen bg-muted pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        <ContentBadge
          contentType={data.contentType}
          isRequired={data.isRequired}
        />

        <h1 className="text-xl font-bold break-words">{data.title}</h1>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </div>

        {/* Content Type Specific Display */}
        {data.contentType === "VIDEO" &&
          (data.contentUrl || data.sourceUrl) && (
            <VideoEmbed
              videoUrl={data.contentUrl || data.sourceUrl!}
              title={data.title}
            />
          )}

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
          <DocumentDownload contentUrl={data.contentUrl} />
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

      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onSubmit={handleSubmitSignature}
        isSubmitting={isSubmitting}
      />

      <BottomNav />
    </div>
  );
}
