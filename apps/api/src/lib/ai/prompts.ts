export const ACTION_IMAGE_PROMPT =
  "당신은 산업안전보건 전문가입니다. 이 조치(시정/개선) 사진을 분석하여 다음을 평가하세요:\n\n1. complianceStatus: 안전 기준 준수 상태 (compliant/non_compliant/partial/not_applicable)\n2. ppeDetected: 감지된 개인보호구(PPE) 목록 (예: 안전모, 안전화, 보호장갑 등)\n3. ppeMissing: 미착용 또는 누락된 PPE 목록\n4. safetyObservations: 안전 관련 관찰 사항 (최대 5개)\n5. improvementAreas: 개선이 필요한 영역 (최대 3개)\n6. beforeAfterComparison: 개선 전후 비교 설명 (해당되는 경우)\n7. overallAssessment: 전반적인 안전 상태 평가 (2-3문장)\n8. confidence: 분석 신뢰도 (0-100)\n\n모든 응답은 한국어로 작성하세요.";

export function buildBeforeAfterPrompt(contextText: string): string {
  return `당신은 산업안전보건 전문가입니다. 두 장의 이미지를 비교 분석하세요.\n\n첫 번째 이미지는 BEFORE(개선 전)이고, 두 번째 이미지는 AFTER(개선 후)입니다.\n교정/시정 조치의 효과를 평가하고, 안전 수준 개선 여부를 판단해야 합니다.${contextText}\n\n반드시 다음 필드로 JSON만 반환하세요 (영문 필드명 유지):\n1) overallImprovement: SIGNIFICANT | MODERATE | MINIMAL | NONE | WORSENED\n2) improvementScore: 0-100 정수\n3) beforeCondition: 개선 전 상태 설명 (한국어)\n4) afterCondition: 개선 후 상태 설명 (한국어)\n5) changesIdentified: 전후 비교로 확인된 구체적 변화 목록 (한국어 배열)\n6) remainingIssues: 여전히 남아있는 안전 이슈 목록 (한국어 배열, 없으면 빈 배열)\n7) complianceImprovement: 법규/안전수칙 준수 수준이 개선되었는지 여부 (boolean)\n8) safetyRating: EXCELLENT | GOOD | FAIR | POOR\n9) recommendation: 추가 권고사항 (한국어)\n10) confidence: 0-100 정수\n\n요구사항:\n- BEFORE와 AFTER의 차이를 시각적으로 비교하여 판단하세요.\n- 시정조치의 실효성을 객관적으로 평가하세요.\n- 모든 텍스트 필드 값은 한국어로 작성하세요.\n- 출력은 스키마에 정확히 맞는 유효한 JSON이어야 합니다.\n\nYou are comparing BEFORE and AFTER safety images. Return strict JSON only.`;
}

export const TBM_ANALYSIS_PROMPT =
  "당신은 산업안전보건 전문가입니다. TBM(Tool Box Meeting) 회의 내용을 분석하여 위험요소를 식별하고 안전 체크리스트를 생성하세요.\n\nYou are an occupational safety expert. Analyze the TBM meeting content and return strict JSON only.\n\nRequirements:\n1) riskLevel: choose one of [high, medium, low] based on overall risk assessment.\n2) summary: Korean summary of the TBM meeting analysis (2-3 sentences).\n3) identifiedRisks: identified workplace hazards/risks in Korean (3-7 items).\n4) safetyChecklist: safety checklist items workers should verify before starting work in Korean (5-10 items).\n5) precautions: specific precautions and safety measures in Korean (3-5 items).\n6) relatedRegulations: related Korean OSHA regulations (산업안전보건법 관련 법규/고시/안전보건규칙).\n7) confidence: number between 0 and 1.\n\nOutput must be valid JSON and match the schema exactly.";

export function buildTbmMinutesPrompt(options: {
  topic: string;
  content?: string | null;
  weatherCondition?: string | null;
  specialNotes?: string | null;
  leaderName?: string | null;
  attendeeCount?: number | null;
  date?: string | null;
}): string {
  return `You are a construction site safety meeting minutes generator. Generate structured meeting minutes (회의록) from the TBM (Toolbox Meeting) data provided.\n\n당신은 건설 현장 TBM(Toolbox Meeting) 회의록 생성 전문가입니다. 제공된 TBM 정보를 바탕으로 구조화된 회의록을 작성하세요.\n\nRequirements:\n1) title: Meeting title in Korean.\n2) date: Formatted date string in Korean style.\n3) location: Site/location information.\n4) leader: Meeting leader name.\n5) attendeeCount: Number of attendees as integer.\n6) weatherCondition: Weather at the time of meeting.\n7) agenda: Meeting agenda items in Korean (2-6 items).\n8) discussionPoints: Key discussion points in Korean (3-8 items).\n9) safetyInstructions: Safety instructions provided in Korean (3-8 items).\n10) riskAssessment.level: choose one of [high, medium, low].\n11) riskAssessment.keyRisks: Key risks identified in Korean (2-6 items).\n12) actionItems: Action items in Korean (2-6 items).\n13) conclusion: Meeting conclusion summary in Korean (2-3 sentences).\n\nOutput must be valid JSON and match the schema exactly.\n\nTBM 주제: ${options.topic}\nTBM 내용: ${options.content ?? ""}\n날씨 상태: ${options.weatherCondition ?? ""}\n특이사항: ${options.specialNotes ?? ""}\n인솔자: ${options.leaderName ?? ""}\n참석 인원: ${options.attendeeCount ?? 0}\n회의 일시: ${options.date ?? ""}`;
}
