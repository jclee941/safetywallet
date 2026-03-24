import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

const credentials = {
  apiKey: "test-api-key",
  textModel: "text-model",
  multimodalModel: "multimodal-model",
  siteUrl: "https://safetywallet.example",
  appName: "SafetyWallet API",
};

const imageBuffer = new Uint8Array([105, 109, 103, 45, 100, 97, 116, 97])
  .buffer as ArrayBuffer;

function openRouterResponse(content: unknown, model = "openrouter/model") {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("gemini-ai", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("getAiCredentials", () => {
    it("returns null when API key is missing", async () => {
      const { getAiCredentials } = await import("../gemini-ai");

      expect(getAiCredentials({})).toBeNull();
    });

    it("returns mapped credentials when API key exists", async () => {
      const { getAiCredentials } = await import("../gemini-ai");

      expect(
        getAiCredentials({
          OPENROUTER_API_KEY: "k",
          OPENROUTER_MODEL_TEXT: "t",
          OPENROUTER_MODEL_MULTIMODAL: "m",
          OPENROUTER_SITE_URL: "https://site",
          OPENROUTER_APP_NAME: "app",
        }),
      ).toEqual({
        apiKey: "k",
        textModel: "t",
        multimodalModel: "m",
        siteUrl: "https://site",
        appName: "app",
      });
    });
  });

  describe("analyzeHazardImage", () => {
    it("returns null for invalid inputs", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const missingMime = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "",
      );
      const emptyImage = await analyzeHazardImage(
        credentials,
        new ArrayBuffer(0),
        "image/png",
      );

      expect(missingMime).toBeNull();
      expect(emptyImage).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns parsed result for valid hazard JSON", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            hazardType: "fire",
            severity: "high",
            description: "화재 위험",
            recommendations: ["소화기 배치"],
            detectedObjects: ["배선"],
            confidence: 0.93,
            relatedRegulations: ["산업안전보건법"],
          }),
          "model-v1",
        ),
      );

      const result = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "image/png",
      );

      expect(result).toEqual({
        hazardType: "fire",
        severity: "high",
        description: "화재 위험",
        recommendations: ["소화기 배치"],
        detectedObjects: ["배선"],
        confidence: 0.93,
        relatedRegulations: ["산업안전보건법"],
        modelVersion: "model-v1",
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };

      expect(body.model).toBe("multimodal-model");
      expect(body.messages[0]?.content[0]?.type).toBe("text");
      expect(body.messages[0]?.content[0]?.text).toContain(
        "JSON schema reference:",
      );
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
        "HTTP-Referer": "https://safetywallet.example",
        "X-OpenRouter-Title": "SafetyWallet API",
      });
    });

    it("returns null on non-ok OpenRouter response", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("bad request", { status: 400 }),
      );

      const result = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "image/jpeg",
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("returns null when parsed shape is invalid", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          '```json\n{"hazardType":"invalid","severity":"high","description":"x","recommendations":["a"],"detectedObjects":["b"],"confidence":0.2,"relatedRegulations":["r"]}\n```',
        ),
      );

      const result = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "image/jpeg",
      );

      expect(result).toBeNull();
    });

    it("returns null when AI response content is empty", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse("   "),
      );

      const result = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "image/jpeg",
      );

      expect(result).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      const { analyzeHazardImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

      const result = await analyzeHazardImage(
        credentials,
        imageBuffer,
        "image/jpeg",
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("classifyPost", () => {
    it("returns null for empty content", async () => {
      const { classifyPost } = await import("../gemini-ai");

      expect(await classifyPost(credentials, "")).toBeNull();
      expect(await classifyPost(credentials, "   ")).toBeNull();
    });

    it("classifies non-hazard post and normalizes undefined subcategory to null", async () => {
      const { classifyPost } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse([
          {
            type: "text",
            text: 'prefix {"suggestedCategory":"SUGGESTION","suggestedHazardType":null,"suggestedRiskLevel":"LOW","classificationReason":"개선 제안","keyFindings":["A"],"confidence":0.8} suffix',
          },
        ]),
      );

      const result = await classifyPost(credentials, "개선했으면 좋겠습니다");

      expect(result).toEqual({
        suggestedCategory: "SUGGESTION",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "개선 제안",
        keyFindings: ["A"],
        confidence: 0.8,
        modelVersion: "openrouter/model",
      });
    });

    it("classifies hazard post with image input", async () => {
      const { classifyPost } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            suggestedCategory: "HAZARD",
            suggestedHazardType: "전도",
            suggestedHazardSubcategory: "FALL",
            suggestedRiskLevel: "HIGH",
            classificationReason: "추락 위험",
            keyFindings: ["난간 미설치", "고소 작업"],
            confidence: 0.91,
          }),
          "post-model-v2",
        ),
      );

      const result = await classifyPost(
        credentials,
        "난간이 없습니다",
        imageBuffer,
        "image/png",
      );

      expect(result?.suggestedCategory).toBe("HAZARD");
      expect(result?.modelVersion).toBe("post-model-v2");

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        model: string;
      };
      expect(body.model).toBe("multimodal-model");
    });

    it("returns null when classification payload is invalid", async () => {
      const { classifyPost } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse('[\n  {"suggestedCategory":"HAZARD"}\n]'),
      );

      const result = await classifyPost(credentials, "위험함");

      expect(result).toBeNull();
    });

    it("returns null when response is malformed JSON", async () => {
      const { classifyPost } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse("{not-json"),
      );

      const result = await classifyPost(credentials, "위험함");

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("analyzeEducationContent", () => {
    it("returns null when TEXT content is missing", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");

      const result = await analyzeEducationContent(credentials, "TEXT", {});
      expect(result).toBeNull();
    });

    it("returns null when IMAGE has empty binary", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");

      const result = await analyzeEducationContent(credentials, "IMAGE", {
        imageData: new ArrayBuffer(0),
        mimeType: "image/png",
      });
      expect(result).toBeNull();
    });

    it("returns null for IMAGE without payload (else branch)", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");

      const result = await analyzeEducationContent(credentials, "IMAGE", {
        mimeType: "image/png",
      });
      expect(result).toBeNull();
    });

    it("analyzes TEXT content successfully", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            category: "safety_training",
            qualityLevel: "good",
            summary: "교육 요약",
            keyLearningPoints: ["위험 인지"],
            safetyRelevance: "현장 안전에 중요",
            relatedStatutoryTraining: ["정기안전교육"],
            improvements: ["사례 추가"],
            targetAudience: "현장 근로자",
            confidence: 0.77,
          }),
        ),
      );

      const result = await analyzeEducationContent(credentials, "TEXT", {
        title: "안전교육",
        textContent: "추락 방지 교육",
      });

      expect(result?.modelVersion).toBe("openrouter/model");

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };

      expect(body.model).toBe("text-model");
      expect(body.messages[0]?.content[0]?.text).toContain("교육 콘텐츠 제목");
    });

    it("analyzes DOCUMENT content and enables file parser plugin", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            category: "regulatory_compliance",
            qualityLevel: "adequate",
            summary: "문서 분석",
            keyLearningPoints: ["법규 준수"],
            safetyRelevance: "관련 있음",
            relatedStatutoryTraining: ["관리감독자 교육"],
            improvements: ["도식화"],
            targetAudience: "관리자",
            confidence: 0.64,
          }),
        ),
      );

      const result = await analyzeEducationContent(credentials, "DOCUMENT", {
        imageData: imageBuffer,
        mimeType: "application/pdf",
      });

      expect(result?.category).toBe("regulatory_compliance");

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        plugins?: Array<{ id: string }>;
        messages: Array<{
          content: Array<{
            type: string;
            file?: { filename: string; file_data: string };
          }>;
        }>;
      };
      expect(body.plugins).toEqual([
        { id: "file-parser", pdf: { engine: "pdf-text" } },
      ]);
      const filePart = body.messages[0]?.content.find(
        (part) => part.type === "file",
      );
      expect(filePart?.file?.filename).toBe("education-content.pdf");
      expect(
        filePart?.file?.file_data.startsWith("data:application/pdf;base64,"),
      ).toBe(true);
    });

    it("returns null when education payload shape is invalid", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            category: "invalid",
            qualityLevel: "good",
            summary: "x",
            keyLearningPoints: ["a"],
            safetyRelevance: "b",
            relatedStatutoryTraining: ["c"],
            improvements: ["d"],
            targetAudience: "e",
            confidence: 0.5,
          }),
        ),
      );

      const result = await analyzeEducationContent(credentials, "TEXT", {
        textContent: "내용",
      });

      expect(result).toBeNull();
    });

    it("returns null when education analysis throws", async () => {
      const { analyzeEducationContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("education timeout"),
      );

      const result = await analyzeEducationContent(credentials, "TEXT", {
        textContent: "내용",
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI education analysis failed",
        expect.objectContaining({
          error: {
            name: "AiEducationAnalysisError",
            message: "education timeout",
          },
        }),
      );
    });
  });

  describe("analyzeTbmRecord", () => {
    it("returns null when topic is missing", async () => {
      const { analyzeTbmRecord } = await import("../gemini-ai");

      expect(await analyzeTbmRecord(credentials, { topic: "" })).toBeNull();
    });

    it("returns analyzed TBM result", async () => {
      const { analyzeTbmRecord } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            riskLevel: "medium",
            summary: "요약",
            identifiedRisks: ["낙하"],
            safetyChecklist: ["보호구 확인"],
            precautions: ["통제선 설치"],
            relatedRegulations: ["안전규칙"],
            confidence: 0.66,
          }),
        ),
      );

      const result = await analyzeTbmRecord(credentials, {
        topic: "아침 TBM",
        content: "고소 작업",
        weatherCondition: "맑음",
        specialNotes: "없음",
      });

      expect(result?.riskLevel).toBe("medium");

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: Array<{ text: string }> }>;
      };
      expect(body.model).toBe("text-model");
      expect(body.messages[0]?.content[0]?.text).toContain("날씨 상태");
      expect(body.messages[0]?.content[0]?.text).toContain("특이사항");
    });

    it("returns null on invalid TBM payload", async () => {
      const { analyzeTbmRecord } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            riskLevel: "invalid",
            summary: "x",
            identifiedRisks: ["a"],
            safetyChecklist: ["b"],
            precautions: ["c"],
            relatedRegulations: ["d"],
            confidence: 0.1,
          }),
        ),
      );

      const result = await analyzeTbmRecord(credentials, { topic: "t" });

      expect(result).toBeNull();
    });

    it("returns null when TBM response root is not an object", async () => {
      const { analyzeTbmRecord } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(JSON.stringify("not-object")),
      );

      const result = await analyzeTbmRecord(credentials, { topic: "t" });

      expect(result).toBeNull();
    });

    it("returns null when fetch rejects", async () => {
      const { analyzeTbmRecord } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("network");

      const result = await analyzeTbmRecord(credentials, { topic: "t" });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("generateQuizFromContent", () => {
    it("returns null when required input is missing", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");

      expect(
        await generateQuizFromContent(credentials, {
          contentTitle: "",
          contentAnalysis: "{}",
        }),
      ).toBeNull();
      expect(
        await generateQuizFromContent(credentials, {
          contentTitle: "제목",
          contentAnalysis: "",
        }),
      ).toBeNull();
    });

    it("returns generated quiz for valid payload", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            quizTitle: "안전 퀴즈",
            questions: [
              {
                question: "문항1",
                options: ["A", "B", "C", "D"],
                correctAnswer: 1,
                explanation: "설명",
                questionType: "SINGLE_CHOICE",
              },
              {
                question: "문항2",
                options: ["O (맞다)", "X (틀리다)"],
                correctAnswer: 0,
                explanation: "설명",
                questionType: "OX",
              },
            ],
          }),
        ),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "고소작업 교육",
        contentAnalysis: '{"summary":"..."}',
      });

      expect(result?.quizTitle).toBe("안전 퀴즈");
      expect(result?.questions).toHaveLength(2);
    });

    it("returns null for invalid quiz shape", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            quizTitle: "잘못된 퀴즈",
            questions: [
              {
                question: "OX 문항",
                options: ["하나"],
                correctAnswer: 0,
                explanation: "설명",
                questionType: "OX",
              },
            ],
          }),
        ),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
    });

    it("returns null when quiz title is missing", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(JSON.stringify({ questions: [{ question: "q" }] })),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
    });

    it("returns null when question element is null", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({ quizTitle: "퀴즈", questions: [null] }),
        ),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
    });

    it("returns null when quiz payload root is not an object", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(JSON.stringify(["bad-root"])),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
    });

    it("returns null when question field types are wrong", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            quizTitle: "퀴즈",
            questions: [
              {
                question: "문항",
                options: ["A", "B", "C", "D"],
                correctAnswer: "zero",
                explanation: "설명",
                questionType: "SINGLE_CHOICE",
              },
            ],
          }),
        ),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
    });

    it("returns null when quiz generation throws an Error", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("quiz generation failed"),
      );

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI quiz generation failed",
        expect.objectContaining({
          error: {
            name: "AiQuizGenerationError",
            message: "quiz generation failed",
          },
        }),
      );
    });

    it("returns null when quiz generation throws a non-Error value", async () => {
      const { generateQuizFromContent } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("timeout");

      const result = await generateQuizFromContent(credentials, {
        contentTitle: "제목",
        contentAnalysis: "분석",
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI quiz generation failed",
        expect.objectContaining({
          error: {
            name: "AiQuizGenerationError",
            message: "timeout",
          },
        }),
      );
    });
  });

  describe("analyzeActionImage", () => {
    it("returns null when image data or mime type is missing", async () => {
      const { analyzeActionImage } = await import("../gemini-ai");

      expect(await analyzeActionImage(credentials, "", "image/png")).toBeNull();
      expect(await analyzeActionImage(credentials, "abc", "")).toBeNull();
    });

    it("returns action image analysis for valid payload", async () => {
      const { analyzeActionImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            complianceStatus: "compliant",
            ppeDetected: ["안전모"],
            ppeMissing: [],
            safetyObservations: ["정리 상태 양호"],
            improvementAreas: ["표지판 보강"],
            beforeAfterComparison: null,
            overallAssessment: "전반적으로 양호",
            confidence: 81,
          }),
        ),
      );

      const result = await analyzeActionImage(
        credentials,
        "ZmFrZSBiYXNlNjQ=",
        "image/jpeg",
      );

      expect(result?.complianceStatus).toBe("compliant");
      expect(result?.confidence).toBe(81);
    });

    it("returns null for invalid action image payload", async () => {
      const { analyzeActionImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            complianceStatus: "partial",
            ppeDetected: ["안전모"],
            ppeMissing: [],
            safetyObservations: ["관찰"],
            improvementAreas: ["개선"],
            beforeAfterComparison: null,
            overallAssessment: "평가",
            confidence: 101,
          }),
        ),
      );

      const result = await analyzeActionImage(
        credentials,
        "base64",
        "image/jpeg",
      );

      expect(result).toBeNull();
    });

    it("returns null when action image analysis throws", async () => {
      const { analyzeActionImage } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));

      const result = await analyzeActionImage(
        credentials,
        "base64",
        "image/jpeg",
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("compareBeforeAfterImages", () => {
    it("returns null when required image inputs are missing", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");

      expect(
        await compareBeforeAfterImages(credentials, "", "after", "image/png"),
      ).toBeNull();
      expect(
        await compareBeforeAfterImages(credentials, "before", "", "image/png"),
      ).toBeNull();
      expect(
        await compareBeforeAfterImages(credentials, "before", "after", ""),
      ).toBeNull();
    });

    it("returns comparison result for valid before/after payload", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            overallImprovement: "SIGNIFICANT",
            improvementScore: 90,
            beforeCondition: "개선 전 설명",
            afterCondition: "개선 후 설명",
            changesIdentified: ["난간 설치"],
            remainingIssues: [],
            complianceImprovement: true,
            safetyRating: "EXCELLENT",
            recommendation: "유지 관리",
            confidence: 88,
          }),
          "compare-model",
        ),
      );

      const result = await compareBeforeAfterImages(
        credentials,
        "before-base64",
        "after-base64",
        "image/png",
        "외벽 고소 작업",
      );

      expect(result?.overallImprovement).toBe("SIGNIFICANT");
      expect(result?.modelVersion).toBe("compare-model");

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: Array<{ type: string; text?: string }> }>;
      };
      expect(body.messages[0]?.content[0]?.text).toContain("Action Context");
    });

    it("returns null for invalid comparison shape", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            overallImprovement: "MINIMAL",
            improvementScore: 40,
            beforeCondition: "전",
            afterCondition: "후",
            changesIdentified: ["변화"],
            remainingIssues: [],
            complianceImprovement: true,
            safetyRating: "FAIR",
            recommendation: "추가 점검",
            confidence: 120,
          }),
        ),
      );

      const result = await compareBeforeAfterImages(
        credentials,
        "before",
        "after",
        "image/png",
      );

      expect(result).toBeNull();
    });

    it("returns null when comparison throws an Error", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("comparison failed"),
      );

      const result = await compareBeforeAfterImages(
        credentials,
        "before",
        "after",
        "image/png",
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI before/after comparison failed",
        expect.objectContaining({
          error: {
            name: "AiBeforeAfterComparisonError",
            message: "comparison failed",
          },
        }),
      );
    });

    it("returns null when comparison throws a non-Error value", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("network failure");

      const result = await compareBeforeAfterImages(
        credentials,
        "before",
        "after",
        "image/png",
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI before/after comparison failed",
        expect.objectContaining({
          error: {
            name: "AiBeforeAfterComparisonError",
            message: "network failure",
          },
        }),
      );
    });

    it("returns null when parsed comparison result is not an object", async () => {
      const { compareBeforeAfterImages } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse("null"),
      );

      const result = await compareBeforeAfterImages(
        credentials,
        "before",
        "after",
        "image/png",
      );

      expect(result).toBeNull();
    });
  });

  describe("generateAnnouncementDraft", () => {
    it("returns null when keywords are missing", async () => {
      const { generateAnnouncementDraft } = await import("../gemini-ai");

      expect(await generateAnnouncementDraft(credentials, "")).toBeNull();
    });

    it("returns announcement draft for valid payload", async () => {
      const { generateAnnouncementDraft } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            title: "폭염 대응 안전수칙 안내",
            content: "<h3>안내</h3><p>충분한 수분 섭취</p>",
          }),
          "announcement-model",
        ),
      );

      const result = await generateAnnouncementDraft(
        credentials,
        "폭염, 휴식, 수분",
      );

      expect(result).toEqual({
        title: "폭염 대응 안전수칙 안내",
        content: "<h3>안내</h3><p>충분한 수분 섭취</p>",
        modelVersion: "announcement-model",
      });
    });

    it("returns null when announcement payload is invalid", async () => {
      const { generateAnnouncementDraft } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(JSON.stringify({ title: "제목만" })),
      );

      const result = await generateAnnouncementDraft(credentials, "키워드");

      expect(result).toBeNull();
    });

    it("returns null when announcement generation throws", async () => {
      const { generateAnnouncementDraft } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("outage"));

      const result = await generateAnnouncementDraft(credentials, "키워드");

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("returns null when parsed result is not an object", async () => {
      const { generateAnnouncementDraft } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse("null"),
      );

      const result = await generateAnnouncementDraft(credentials, "키워드");

      expect(result).toBeNull();
    });
  });

  describe("generateTbmMeetingMinutes", () => {
    it("returns null when topic is empty", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");

      expect(
        await generateTbmMeetingMinutes(credentials, { topic: "" }),
      ).toBeNull();
    });

    it("returns structured TBM meeting minutes", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            title: "TBM 회의록",
            date: "2026-03-20",
            location: "A동",
            leader: "홍길동",
            attendeeCount: 12,
            weatherCondition: "맑음",
            agenda: ["작업 전 점검"],
            discussionPoints: ["추락 방지"],
            safetyInstructions: ["안전모 착용"],
            riskAssessment: {
              level: "high",
              keyRisks: ["추락"],
            },
            actionItems: ["난간 재점검"],
            conclusion: "안전수칙 준수 필요",
          }),
        ),
      );

      const result = await generateTbmMeetingMinutes(credentials, {
        topic: "고소 작업",
        content: "외벽 작업",
        weatherCondition: "맑음",
        specialNotes: "강풍 주의",
        leaderName: "홍길동",
        attendeeCount: 12,
        date: "2026-03-20",
      });

      expect(result?.title).toBe("TBM 회의록");
      expect(result?.riskAssessment.level).toBe("high");
    });

    it("returns null when meeting minutes shape is invalid", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            title: "TBM 회의록",
            date: "2026-03-20",
            location: "A동",
            leader: "홍길동",
            attendeeCount: 12.4,
            weatherCondition: "맑음",
            agenda: ["작업 전 점검"],
            discussionPoints: ["추락 방지"],
            safetyInstructions: ["안전모 착용"],
            riskAssessment: {
              level: "high",
              keyRisks: ["추락"],
            },
            actionItems: ["난간 재점검"],
            conclusion: "안전수칙 준수 필요",
          }),
        ),
      );

      const result = await generateTbmMeetingMinutes(credentials, {
        topic: "고소 작업",
      });

      expect(result).toBeNull();
    });

    it("returns null when minutes generation throws", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("server down"),
      );

      const result = await generateTbmMeetingMinutes(credentials, {
        topic: "고소 작업",
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("returns null when payload is not an object", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse("null"),
      );

      const result = await generateTbmMeetingMinutes(credentials, {
        topic: "고소 작업",
      });

      expect(result).toBeNull();
    });

    it("returns null when riskAssessment is null", async () => {
      const { generateTbmMeetingMinutes } = await import("../gemini-ai");
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        openRouterResponse(
          JSON.stringify({
            title: "TBM 회의록",
            date: "2026-03-20",
            location: "A동",
            leader: "홍길동",
            attendeeCount: 12,
            weatherCondition: "맑음",
            agenda: ["작업 전 점검"],
            discussionPoints: ["추락 방지"],
            safetyInstructions: ["안전모 착용"],
            riskAssessment: null,
            actionItems: ["난간 재점검"],
            conclusion: "안전수칙 준수 필요",
          }),
        ),
      );

      const result = await generateTbmMeetingMinutes(credentials, {
        topic: "고소 작업",
      });

      expect(result).toBeNull();
    });
  });
});
