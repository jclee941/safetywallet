import { Video } from "lucide-react";
import { toYouTubeEmbedUrl, toYouTubeWatchUrl } from "../utils";

interface VideoEmbedProps {
  videoUrl: string;
  title: string;
}

export function VideoEmbed({ videoUrl, title }: VideoEmbedProps) {
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
          title={title}
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
}
