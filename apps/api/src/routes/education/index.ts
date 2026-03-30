import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { success, error } from "../../lib/response";
import type { AppType } from "./helpers";
import { contentsCrud } from "./contents-routes";
import { contentsAi } from "./contents-ai";
import quizzesRoute from "./quizzes";
import quizAttemptsRoute from "./quiz-attempts";
import statutoryRoute from "./statutory";
import tbmRoute from "./tbm";
import completionsRoute from "./completions";

const app = new Hono<AppType>();

app.use("*", authMiddleware);

const defaultRateLimit = rateLimitMiddleware();
app.use("*", defaultRateLimit);

app.get("/youtube-oembed", async (c) => {
  const url = c.req.query("url");
  if (!url) return error(c, "MISSING_URL", "url query param required", 400);

  const ytRegex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(ytRegex);
  if (!match) {
    return error(
      c,
      "INVALID_YOUTUBE_URL",
      "유효하지 않은 YouTube URL입니다",
      400,
    );
  }

  const videoId = match[1];
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  try {
    const resp = await fetch(oembedUrl);
    if (!resp.ok) {
      return error(
        c,
        "YOUTUBE_FETCH_FAILED",
        "YouTube 정보를 가져올 수 없습니다",
        502,
      );
    }

    const data = (await resp.json()) as {
      title?: string;
      author_name?: string;
      html?: string;
    };

    return success(c, {
      videoId,
      title: data.title,
      thumbnailUrl: `https://img.youtube.com/img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      authorName: data.author_name,
      html: data.html,
    });
  } catch {
    return error(c, "YOUTUBE_FETCH_ERROR", "YouTube API 오류", 502);
  }
});

app.route("/contents", contentsCrud);
app.route("/contents", contentsAi);
app.route("/quizzes", quizzesRoute);
app.route("/quizzes", quizAttemptsRoute);
app.route("/statutory", statutoryRoute);
app.route("/tbm", tbmRoute);
app.route("/completions", completionsRoute);

export default app;
