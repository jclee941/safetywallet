"use client";

import { useRef } from "react";
import { useTranslation } from "@/hooks/use-translation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  useToast,
} from "@safetywallet/ui";

interface FileUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
}

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = 5,
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const t = useTranslation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const validFiles: File[] = [];
    let skippedCount = 0;

    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: t("posts.error.uploadFailed"),
        variant: "destructive",
      });
      return;
    }

    selectedFiles.forEach((file) => {
      const maxSize = file.type.startsWith("video/")
        ? 50 * 1024 * 1024
        : 10 * 1024 * 1024;

      if (file.size > maxSize) {
        skippedCount++;
      } else {
        validFiles.push(file);
      }
    });

    if (skippedCount > 0) {
      toast({
        title: t("common.error"),
        variant: "destructive",
      });
    }

    onFilesChange([...files, ...validFiles]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("posts.new.addPhotoVideo")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors"
        >
          {t("posts.new.addPhotoVideo")}
        </button>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-2 p-2 bg-muted rounded"
              >
                {file.type.startsWith("video/") ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <video
                      src={URL.createObjectURL(file)}
                      className="h-16 w-24 rounded object-cover bg-black"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm truncate">{file.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-xs text-destructive hover:underline"
                >
                  {t("common.delete")}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
