export function toYouTubeEmbedUrl(url: string): string {
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

export function toYouTubeWatchUrl(url: string): string | null {
  const embedUrl = toYouTubeEmbedUrl(url);
  const match = embedUrl.match(/\/embed\/([^/?#]+)/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}
