"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { compressImages } from "@/lib/image-compress";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/lib/api";
import { useCreatePost } from "@/hooks/use-api";
import { UnsafeWarningModal } from "@/components/unsafe-warning-modal";
import { Category, RiskLevel, Visibility } from "@safetywallet/types";
import type { CreatePostDto, HazardSubcategory } from "@safetywallet/types";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from "@safetywallet/ui";
import { CategorySelector } from "./components/category-selector";
import { HazardSubcategorySelector } from "./components/hazard-subcategory-selector";
import { RiskLevelSelector } from "./components/risk-level-selector";
import { FileUploader } from "./components/file-uploader";
import { UnsafeBehaviorWarning } from "./components/unsafe-behavior-warning";
import { usePostDraft } from "./hooks/use-post-draft";

export function NewPostClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentSiteId } = useAuth();
  const t = useTranslation();
  const createPost = useCreatePost();

  const [category, setCategory] = useState<Category | null>(null);
  const [hazardSubcategory, setHazardSubcategory] =
    useState<HazardSubcategory | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [content, setContent] = useState("");
  const [locationFloor, setLocationFloor] = useState("");
  const [locationZone, setLocationZone] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const DRAFT_KEY = `safetywallet_post_draft_${currentSiteId || "default"}`;

  const handleLoadDraft = useCallback(
    (draft: {
      category: Category | null;
      hazardSubcategory: HazardSubcategory | null;
      riskLevel: RiskLevel | null;
      content: string;
      locationFloor: string;
      locationZone: string;
      isAnonymous: boolean;
    }) => {
      if (draft.category) setCategory(draft.category);
      if (draft.hazardSubcategory)
        setHazardSubcategory(draft.hazardSubcategory);
      if (draft.riskLevel) setRiskLevel(draft.riskLevel);
      if (draft.content) setContent(draft.content);
      if (draft.locationFloor) setLocationFloor(draft.locationFloor);
      if (draft.locationZone) setLocationZone(draft.locationZone);
      if (draft.isAnonymous) setIsAnonymous(draft.isAnonymous);
    },
    [],
  );

  const { saveDraft, clearDraft, initDraft } = usePostDraft({
    draftKey: DRAFT_KEY,
    onLoadDraft: handleLoadDraft,
  });

  // Migrate legacy draft key on first render
  useEffect(() => {
    const LEGACY_DRAFT_KEY = `safework2_post_draft_${currentSiteId || "default"}`;
    try {
      const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (legacy) {
        localStorage.setItem(DRAFT_KEY, legacy);
        localStorage.removeItem(LEGACY_DRAFT_KEY);
      }
    } catch {
      // ignore
    }
  }, [DRAFT_KEY, currentSiteId]);

  // Load draft on mount
  useEffect(() => {
    initDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAFT_KEY]);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(
      () =>
        saveDraft({
          category,
          hazardSubcategory,
          riskLevel,
          content,
          locationFloor,
          locationZone,
          isAnonymous,
        }),
      2000,
    );
    return () => clearTimeout(timer);
  }, [
    saveDraft,
    category,
    hazardSubcategory,
    riskLevel,
    content,
    locationFloor,
    locationZone,
    isAnonymous,
  ]);

  const submitPost = async () => {
    if (!category || !currentSiteId) return;

    setIsUploading(true);
    setShowWarningModal(false);

    try {
      const postData: CreatePostDto = {
        siteId: currentSiteId,
        category,
        hazardSubcategory:
          category === Category.HAZARD
            ? (hazardSubcategory ?? undefined)
            : undefined,
        riskLevel: riskLevel || undefined,
        content,
        locationFloor: locationFloor || undefined,
        locationZone: locationZone || undefined,
        visibility: Visibility.WORKER_PUBLIC,
        isAnonymous,
      };

      const response = await createPost.mutateAsync(postData);
      const postId = response.data.post.id;

      if (files.length > 0) {
        let successCount = 0;
        let failCount = 0;

        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        const videoFiles = files.filter((f) => f.type.startsWith("video/"));
        const compressedImages = await compressImages(imageFiles);
        const allFiles = [...compressedImages, ...videoFiles];

        for (const file of allFiles) {
          const formData = new FormData();
          formData.append("file", file);

          try {
            await apiFetch(`/posts/${postId}/images`, {
              method: "POST",
              body: formData,
            });
            successCount++;
          } catch {
            failCount++;
          }
        }

        if (failCount > 0) {
          toast({
            title: t("posts.error.uploadFailed"),
            description: `${successCount} ${t("common.ok")}, ${failCount} ${t("common.error")}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: t("posts.success.submitted"),
      });
      clearDraft();
      router.replace("/posts");
    } catch {
      toast({
        title: t("posts.error.uploadFailed"),
        description: t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !currentSiteId) return;

    if (category === Category.UNSAFE_BEHAVIOR) {
      setShowWarningModal(true);
      return;
    }

    await submitPost();
  };

  const handleClearSubcategory = () => setHazardSubcategory(null);
  const handleClearLocation = () => {
    setLocationFloor("");
    setLocationZone("");
  };

  return (
    <div className="min-h-screen bg-muted">
      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <CategorySelector
            value={category}
            onChange={setCategory}
            onClearSubcategory={handleClearSubcategory}
            onClearLocation={handleClearLocation}
          />

          {category === Category.UNSAFE_BEHAVIOR && <UnsafeBehaviorWarning />}

          {category === Category.HAZARD && (
            <HazardSubcategorySelector
              value={hazardSubcategory}
              onChange={setHazardSubcategory}
            />
          )}

          {(category === Category.HAZARD ||
            category === Category.UNSAFE_BEHAVIOR) && (
            <RiskLevelSelector value={riskLevel} onChange={setRiskLevel} />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("posts.description")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder={t("posts.description")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-32 p-3 border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
              />
            </CardContent>
          </Card>

          {category !== Category.INCONVENIENCE && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("posts.location")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder={t("posts.location")}
                  value={locationFloor}
                  onChange={(e) => setLocationFloor(e.target.value)}
                />
                <Input
                  placeholder={t("posts.new.zone")}
                  value={locationZone}
                  onChange={(e) => setLocationZone(e.target.value)}
                />
              </CardContent>
            </Card>
          )}

          <FileUploader files={files} onFilesChange={setFiles} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("common.info")}</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span className="text-sm">{t("posts.new.anonymous")}</span>
              </label>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!category || isUploading}
              className="flex-1"
            >
              {isUploading ? t("common.loading") : t("posts.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </main>

      <UnsafeWarningModal
        open={showWarningModal}
        onConfirm={submitPost}
        onCancel={() => setShowWarningModal(false)}
      />
    </div>
  );
}
