"use client";

import { useCallback } from "react";
import type {
  Category,
  HazardSubcategory,
  RiskLevel,
} from "@safetywallet/types";

interface PostDraft {
  category: Category | null;
  hazardSubcategory: HazardSubcategory | null;
  riskLevel: RiskLevel | null;
  content: string;
  locationFloor: string;
  locationZone: string;
  isAnonymous: boolean;
  savedAt: number;
}

interface UsePostDraftOptions {
  draftKey: string;
  onLoadDraft: (draft: PostDraft) => void;
}

export function usePostDraft({ draftKey, onLoadDraft }: UsePostDraftOptions) {
  const saveDraft = useCallback(
    (draft: Omit<PostDraft, "savedAt">) => {
      const fullDraft: PostDraft = {
        ...draft,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(fullDraft));
      } catch {
        // storage full or unavailable
      }
    },
    [draftKey],
  );

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return null;
      const draft: PostDraft = JSON.parse(saved);
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey);
        return null;
      }
      return draft;
    } catch {
      // corrupted draft
      return null;
    }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  const initDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      onLoadDraft(draft);
    }
  }, [loadDraft, onLoadDraft]);

  return { saveDraft, loadDraft, clearDraft, initDraft };
}
