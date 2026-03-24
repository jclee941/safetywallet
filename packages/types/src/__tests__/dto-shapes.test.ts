import { describe, expect, it } from "vitest";
import {
  ActionPriority,
  ActionStatus,
  Category,
  EducationContentType,
  MembershipStatus,
  QuizStatus,
  QuestionType,
  RejectReason,
  ReviewAction,
  ReviewStatus,
  RiskLevel,
  StatutoryTrainingType,
  TrainingCompletionStatus,
  UserRole,
  Visibility,
  VoteCandidateSource,
} from "../enums";
import type {
  AnnouncementDto,
  ApiResponse,
  AuthResponseDto,
  AwardPointsDto,
  CreateActionDto,
  CreateAnnouncementDto,
  CreateEducationContentDto,
  CreatePostDto,
  CreateQuizDto,
  CreateSiteDto,
  CreateStatutoryTrainingDto,
  CreateTbmRecordDto,
  CreateVoteCandidateDto,
  DashboardStatsDto,
  EducationContentDto,
  EducationContentListDto,
  ErrorResponse,
  MeResponseDto,
  MyVoteDto,
  OtpRequestDto,
  OtpVerifyDto,
  PaginatedResponse,
  PointsBalanceDto,
  PointsDistributionDto,
  PointsHistoryFilterDto,
  PointsHistoryItemDto,
  PointsLedgerDto,
  PostDto,
  PostFilterDto,
  PostImageDto,
  PostListDto,
  QuizAttemptDto,
  QuizAttemptFilterDto,
  QuizDto,
  QuizListDto,
  QuizQuestionDto,
  ReviewActionDto,
  ReviewDto,
  RevokePointsDto,
  SiteDto,
  SiteMemberDto,
  StatutoryTrainingDto,
  StatutoryTrainingFilterDto,
  SubmitQuizAttemptDto,
  TbmAttendeeDto,
  TbmRecordDto,
  TbmRecordFilterDto,
  TbmRecordListDto,
  TokenPayloadDto,
  TokenRefreshDto,
  TrendDataPointDto,
  TrendFilterDto,
  UpdateActionStatusDto,
  UpdateAnnouncementDto,
  UpdateMemberStatusDto,
  UpdateProfileDto,
  UpdateStatutoryTrainingDto,
  UpdateEducationContentDto,
  UpdatePolicyDto,
  UpdateQuizDto,
  UpdateSiteDto,
  UserDto,
  UserProfileDto,
  VoteCandidateDto,
  VoteDto,
  VotePeriodSummaryDto,
  VoteResultDto,
  VoteResultExportDto,
} from "../index";

describe("DTO and envelope shapes", () => {
  it("validates auth and user dto shapes with satisfies", () => {
    const otpRequest = { phone: "01012345678" } satisfies OtpRequestDto;
    const otpVerify = {
      phone: "01012345678",
      otpCode: "123456",
    } satisfies OtpVerifyDto;
    const refresh = { refreshToken: "refresh-token" } satisfies TokenRefreshDto;
    const tokenPayload = {
      sub: "user-1",
      phone: "01012345678",
      role: "WORKER",
      iat: 1700000000,
      exp: 1700003600,
    } satisfies TokenPayloadDto;
    const authResponse = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 3600,
      user: {
        id: "u1",
        phone: "01012345678",
        nameMasked: "홍*동",
        role: "WORKER",
      },
    } satisfies AuthResponseDto;
    const me = {
      id: "u1",
      name: "홍길동",
      nameMasked: "홍*동",
      phone: "01012345678",
      role: "WORKER",
      siteId: "s1",
      siteName: "서울현장",
      permissions: ["READ_POST"],
      todayAttendance: {
        status: "SUCCESS",
        checkInAt: "2026-01-01T00:00:00.000Z",
      },
    } satisfies MeResponseDto;
    const user = {
      id: "u1",
      phone: "01012345678",
      nameMasked: "홍*동",
      role: UserRole.WORKER,
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies UserDto;
    const profile = {
      id: "u1",
      phone: "01012345678",
      nameMasked: "홍*동",
      role: UserRole.SITE_ADMIN,
      piiViewFull: true,
      canAwardPoints: true,
      canManageUsers: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } satisfies UserProfileDto;
    const updateProfile = { name: "홍길동" } satisfies UpdateProfileDto;

    expect(otpRequest.phone).toBeTruthy();
    expect(otpVerify.otpCode).toHaveLength(6);
    expect(refresh.refreshToken).toContain("refresh");
    expect(tokenPayload.exp).toBeGreaterThan(tokenPayload.iat);
    expect(authResponse.user.id).toBe("u1");
    expect(me.todayAttendance?.status).toBe("SUCCESS");
    expect(user.role).toBe(UserRole.WORKER);
    expect(profile.canManageUsers).toBe(true);
    expect(updateProfile.name).toBe("홍길동");
  });

  it("validates site and post dto shapes with satisfies", () => {
    const site = {
      id: "s1",
      name: "서울현장",
      active: true,
      joinEnabled: true,
      requiresApproval: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      closedAt: null,
    } satisfies SiteDto;
    const createSite = {
      name: "부산현장",
      requiresApproval: true,
    } satisfies CreateSiteDto;
    const updateSite = {
      name: "수정현장",
      active: false,
      leaderboardEnabled: true,
    } satisfies UpdateSiteDto;
    const member = {
      id: "m1",
      userId: "u1",
      siteId: "s1",
      status: MembershipStatus.ACTIVE,
      joinedAt: "2026-01-01T00:00:00.000Z",
      leftAt: null,
      user: { id: "u1", phone: "01012345678", nameMasked: "홍*동" },
    } satisfies SiteMemberDto;
    const updateMember = {
      status: MembershipStatus.LEFT,
      reason: "퇴사",
    } satisfies UpdateMemberStatusDto;
    const stats = {
      pendingReviews: 1,
      postsThisWeek: 5,
      activeMembers: 10,
      totalPoints: 100,
    } satisfies DashboardStatsDto;

    const createPost = {
      siteId: "s1",
      category: Category.HAZARD,
      hazardType: "FALL",
      riskLevel: RiskLevel.HIGH,
      locationFloor: "3F",
      locationZone: "A",
      locationDetail: "입구",
      content: "바닥이 미끄럽습니다",
      visibility: Visibility.WORKER_PUBLIC,
      isAnonymous: false,
      imageUrls: ["https://example.com/image.jpg"],
      metadata: { weather: "rain" },
    } satisfies CreatePostDto;
    const postImage = {
      id: "img1",
      fileUrl: "https://example.com/file.jpg",
      mediaType: "image",
      thumbnailUrl: null,
    } satisfies PostImageDto;
    const post = {
      id: "p1",
      userId: "u1",
      siteId: "s1",
      category: Category.HAZARD,
      hazardType: "FALL",
      riskLevel: RiskLevel.HIGH,
      locationFloor: "3F",
      locationZone: "A",
      locationDetail: "입구",
      content: "바닥이 미끄럽습니다",
      visibility: Visibility.ADMIN_ONLY,
      isAnonymous: false,
      reviewStatus: ReviewStatus.IN_REVIEW,
      actionStatus: ActionStatus.ASSIGNED,
      isUrgent: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      images: [postImage],
      author: { id: "u1", nameMasked: "홍*동" },
      hazardSubcategory: null,
    } satisfies PostDto;
    const postList = {
      id: "p1",
      category: Category.BEST_PRACTICE,
      content: "좋은 사례",
      reviewStatus: ReviewStatus.APPROVED,
      actionStatus: ActionStatus.COMPLETED,
      isUrgent: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      imageCount: 1,
      author: { nameMasked: "김*수" },
    } satisfies PostListDto;
    const postFilter = {
      siteId: "s1",
      category: Category.SUGGESTION,
      reviewStatus: ReviewStatus.PENDING,
      actionStatus: ActionStatus.NONE,
      isUrgent: false,
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      page: 1,
      limit: 20,
    } satisfies PostFilterDto;

    expect(site.active).toBe(true);
    expect(createSite.requiresApproval).toBe(true);
    expect(updateSite.active).toBe(false);
    expect(member.status).toBe(MembershipStatus.ACTIVE);
    expect(updateMember.status).toBe(MembershipStatus.LEFT);
    expect(stats.activeMembers).toBeGreaterThan(0);
    expect(createPost.riskLevel).toBe(RiskLevel.HIGH);
    expect(post.images[0]?.id).toBe("img1");
    expect(postList.imageCount).toBe(1);
    expect(postFilter.limit).toBe(20);
  });

  it("validates review, points, and action dto shapes with satisfies", () => {
    const reviewAction = {
      postId: "p1",
      action: ReviewAction.REQUEST_MORE,
      comment: "사진 추가 필요",
      reasonCode: RejectReason.INSUFFICIENT,
    } satisfies ReviewActionDto;
    const review = {
      id: "r1",
      postId: "p1",
      adminId: "admin1",
      action: ReviewAction.APPROVE,
      comment: null,
      reasonCode: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      admin: { id: "admin1", nameMasked: "관*자" },
    } satisfies ReviewDto;

    const awardPoints = {
      userId: "u1",
      siteId: "s1",
      postId: "p1",
      amount: 10,
      reasonCode: "GOOD_REPORT",
      reasonText: "우수 신고",
    } satisfies AwardPointsDto;
    const revokePoints = {
      ledgerId: "l1",
      reason: "오지급",
    } satisfies RevokePointsDto;
    const ledger = {
      id: "l1",
      userId: "u1",
      siteId: "s1",
      postId: null,
      amount: 10,
      reasonCode: "GOOD_REPORT",
      reasonText: null,
      settleMonth: "2026-01",
      occurredAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies PointsLedgerDto;
    const balance = {
      userId: "u1",
      siteId: "s1",
      totalPoints: 100,
      currentMonthPoints: 20,
      settleMonth: "2026-01",
    } satisfies PointsBalanceDto;
    const historyItem = {
      id: "l1",
      amount: 5,
      reasonCode: "BONUS",
      reasonText: "추가 포인트",
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies PointsHistoryItemDto;
    const historyFilter = {
      siteId: "s1",
      userId: "u1",
      settleMonth: "2026-01",
      page: 1,
      limit: 10,
    } satisfies PointsHistoryFilterDto;

    const createAction = {
      postId: "p1",
      assigneeType: "USER",
      assigneeId: "u1",
      dueDate: "2026-01-10",
      priority: ActionPriority.HIGH,
    } satisfies CreateActionDto;
    const updateAction = {
      actionStatus: ActionStatus.COMPLETED,
      completionNote: "조치 완료",
      imageUrls: ["https://example.com/after.jpg"],
    } satisfies UpdateActionStatusDto;
    const updatePolicy = {
      name: "수정 정책",
      description: "수정된 설명",
      defaultAmount: 20,
      isActive: false,
    } satisfies UpdatePolicyDto;

    expect(reviewAction.action).toBe(ReviewAction.REQUEST_MORE);
    expect(review.admin.id).toBe("admin1");
    expect(awardPoints.amount).toBeGreaterThan(0);
    expect(revokePoints.ledgerId).toBe("l1");
    expect(ledger.reasonCode).toBe("GOOD_REPORT");
    expect(balance.totalPoints).toBe(100);
    expect(historyItem.amount).toBe(5);
    expect(historyFilter.page).toBe(1);
    expect(createAction.priority).toBe(ActionPriority.HIGH);
    expect(updateAction.actionStatus).toBe(ActionStatus.COMPLETED);
    expect(updatePolicy.defaultAmount).toBe(20);
  });

  it("validates announcement and vote dto shapes with satisfies", () => {
    const createAnnouncement = {
      siteId: "s1",
      title: "안전 공지",
      content: "보호구 착용 필수",
      isPinned: true,
    } satisfies CreateAnnouncementDto;
    const announcement = {
      id: "a1",
      siteId: "s1",
      authorId: "admin1",
      title: "안전 공지",
      content: "보호구 착용 필수",
      isPinned: true,
      isPublished: true,
      scheduledAt: null,
      status: "PUBLISHED" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      author: { id: "admin1", nameMasked: "관*자" },
    } satisfies AnnouncementDto;
    const updateAnnouncement = {
      title: "수정 공지",
      content: "수정 내용",
      isPinned: false,
    } satisfies UpdateAnnouncementDto;

    const candidate = {
      id: "c1",
      siteId: "s1",
      month: "2026-01",
      userId: "u1",
      userName: "홍길동",
      source: VoteCandidateSource.ADMIN,
      nominatedAt: "2026-01-01T00:00:00.000Z",
      voteCount: 3,
    } satisfies VoteCandidateDto;
    const createCandidate = {
      userId: "u2",
      siteId: "s1",
      month: "2026-01",
      source: VoteCandidateSource.AUTO,
    } satisfies CreateVoteCandidateDto;
    const result = {
      candidateId: "c1",
      candidateName: "홍길동",
      voteCount: 3,
      rank: 1,
    } satisfies VoteResultDto;
    const vote = {
      id: "v1",
      siteId: "s1",
      month: "2026-01",
      voterId: "u9",
      candidateId: "c1",
      candidateName: "홍길동",
      votedAt: "2026-01-02T00:00:00.000Z",
    } satisfies VoteDto;
    const myVote = {
      month: "2026-01",
      candidateId: "c1",
      candidateName: "홍길동",
      votedAt: "2026-01-02T00:00:00.000Z",
    } satisfies MyVoteDto;
    const periodSummary = {
      month: "2026-01",
      siteId: "s1",
      totalCandidates: 10,
      totalVotes: 90,
      isActive: true,
    } satisfies VotePeriodSummaryDto;
    const exportDto = {
      month: "2026-01",
      siteId: "s1",
      siteName: "서울현장",
      results: [result],
      totalVotes: 90,
      exportedAt: "2026-01-31T00:00:00.000Z",
    } satisfies VoteResultExportDto;

    expect(createAnnouncement.isPinned).toBe(true);
    expect(announcement.author.id).toBe("admin1");
    expect(updateAnnouncement.isPinned).toBe(false);
    expect(candidate.source).toBe(VoteCandidateSource.ADMIN);
    expect(createCandidate.source).toBe(VoteCandidateSource.AUTO);
    expect(result.rank).toBe(1);
    expect(vote.candidateId).toBe("c1");
    expect(myVote.month).toBe("2026-01");
    expect(periodSummary.totalCandidates).toBe(10);
    expect(exportDto.results).toHaveLength(1);
  });

  it("validates education and analytics dto shapes with satisfies", () => {
    const createContent = {
      siteId: "s1",
      title: "추락 예방",
      description: "기본 교육",
      contentType: EducationContentType.VIDEO,
      contentUrl: "https://example.com/education.mp4",
    } satisfies CreateEducationContentDto;
    const content = {
      id: "ec1",
      siteId: "s1",
      title: "추락 예방",
      description: "기본 교육",
      contentType: EducationContentType.TEXT,
      contentUrl: null,
      sourceUrl: null,
      thumbnailUrl: null,
      durationMinutes: null,
      externalSource: "LOCAL" as const,
      externalId: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies EducationContentDto;
    const contentList = {
      id: "ec1",
      title: "추락 예방",
      contentType: EducationContentType.IMAGE,
      isActive: true,
      quizCount: 2,
      viewCount: 10,
      completionCount: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies EducationContentListDto;
    const updateContent = {
      title: "수정된 교육",
      contentType: EducationContentType.VIDEO,
      durationMinutes: 30,
    } satisfies UpdateEducationContentDto;
    const createQuiz = {
      siteId: "s1",
      contentId: "ec1",
      title: "안전 퀴즈",
      description: "기본",
      pointsReward: 10,
      timeLimitMinutes: 5,
    } satisfies CreateQuizDto;
    const question = {
      id: "q1",
      questionText: "보호구 착용은?",
      options: ["필수", "선택"],
      correctIndex: 0,
      explanation: "필수입니다",
      sortOrder: 1,
      questionType: QuestionType.SINGLE_CHOICE,
      imageUrl: null,
    } satisfies QuizQuestionDto;
    const quiz = {
      id: "quiz1",
      siteId: "s1",
      contentId: "ec1",
      title: "안전 퀴즈",
      description: "기본",
      status: QuizStatus.PUBLISHED,
      passScore: 80,
      pointsReward: 10,
      timeLimitSec: 300,
      questions: [question],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies QuizDto;
    const quizList = {
      id: "quiz1",
      title: "안전 퀴즈",
      status: QuizStatus.DRAFT,
      passScore: 80,
      pointsReward: 10,
      questionCount: 1,
      attemptCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies QuizListDto;
    const updateQuiz = {
      title: "수정 퀴즈",
      status: QuizStatus.PUBLISHED,
    } satisfies UpdateQuizDto;
    const submitAttempt = {
      quizId: "quiz1",
      siteId: "s1",
      answers: [0],
      startedAt: "2026-01-01T00:00:00.000Z",
    } satisfies SubmitQuizAttemptDto;
    const attempt = {
      id: "qa1",
      quizId: "quiz1",
      userId: "u1",
      siteId: "s1",
      score: 100,
      passed: true,
      answers: [0],
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:05:00.000Z",
      quizTitle: "안전 퀴즈",
      userName: "홍길동",
    } satisfies QuizAttemptDto;
    const attemptFilter = {
      siteId: "s1",
      quizId: "quiz1",
      userId: "u1",
      passed: true,
      page: 1,
      limit: 20,
    } satisfies QuizAttemptFilterDto;

    const createTraining = {
      siteId: "s1",
      userId: "u1",
      trainingType: StatutoryTrainingType.NEW_WORKER,
      trainingName: "신규자 교육",
      hoursCompleted: 8,
      trainingDate: "2026-01-10",
      expirationDate: "2027-01-10",
      provider: "안전기관",
      notes: "메모",
    } satisfies CreateStatutoryTrainingDto;
    const updateTraining = {
      trainingType: StatutoryTrainingType.SPECIAL,
      trainingName: "특별교육 수정",
      trainingDate: "2026-01-10",
      expirationDate: "2027-01-10",
      provider: "안전기관",
      certificateUrl: "https://example.com/cert.pdf",
      hoursCompleted: 8,
      status: TrainingCompletionStatus.COMPLETED,
      notes: "완료",
    } satisfies UpdateStatutoryTrainingDto;
    const training = {
      id: "t1",
      siteId: "s1",
      userId: "u1",
      trainingType: StatutoryTrainingType.SPECIAL,
      trainingName: "특별교육",
      trainingHours: 4,
      scheduledDate: "2026-01-10",
      completedDate: null,
      expiryDate: null,
      status: TrainingCompletionStatus.SCHEDULED,
      certificateUrl: null,
      provider: null,
      notes: null,
      createdById: "admin1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userName: "홍길동",
      creatorName: "관리자",
    } satisfies StatutoryTrainingDto;
    const trainingFilter = {
      siteId: "s1",
      trainingType: StatutoryTrainingType.REGULAR,
      status: TrainingCompletionStatus.EXPIRED,
      userId: "u1",
      page: 1,
      limit: 20,
    } satisfies StatutoryTrainingFilterDto;

    const createTbm = {
      siteId: "s1",
      date: "2026-01-02",
      topic: "작업 전 점검",
      content: "내용",
      leaderId: "u1",
      weatherCondition: "맑음",
      specialNotes: "없음",
    } satisfies CreateTbmRecordDto;
    const attendee = {
      id: "ta1",
      userId: "u1",
      userName: "홍길동",
      signedAt: "2026-01-02T08:00:00.000Z",
    } satisfies TbmAttendeeDto;
    const tbmRecord = {
      id: "tbm1",
      siteId: "s1",
      leaderId: "u9",
      date: "2026-01-02",
      topic: "작업 전 점검",
      content: "내용",
      weatherCondition: "맑음",
      specialNotes: "없음",
      attendeeCount: 1,
      attendees: [attendee],
      leaderName: "반장",
      createdAt: "2026-01-02T08:00:00.000Z",
      updatedAt: "2026-01-02T08:00:00.000Z",
      topicCategory: null,
    } satisfies TbmRecordDto;
    const tbmList = {
      id: "tbm1",
      date: "2026-01-02",
      topic: "작업 전 점검",
      leaderName: "반장",
      attendeeCount: 1,
      createdAt: "2026-01-02T08:00:00.000Z",
      topicCategory: null,
    } satisfies TbmRecordListDto;
    const tbmFilter = {
      siteId: "s1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      leaderId: "u9",
      page: 1,
      limit: 20,
    } satisfies TbmRecordFilterDto;

    const trendData = {
      date: "2026-01-01",
      count: 3,
      category: "HAZARD",
    } satisfies TrendDataPointDto;
    const trendFilter = {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      siteId: "s1",
    } satisfies TrendFilterDto;
    const pointsDistribution = {
      reasonCode: "GOOD_REPORT",
      totalAmount: 120,
      count: 6,
    } satisfies PointsDistributionDto;

    expect(createContent.contentType).toBe(EducationContentType.VIDEO);
    expect(content.isActive).toBe(true);
    expect(contentList.quizCount).toBe(2);
    expect(updateContent.durationMinutes).toBe(30);
    expect(quiz.status).toBe(QuizStatus.PUBLISHED);
    expect(quizList.status).toBe(QuizStatus.DRAFT);
    expect(submitAttempt.answers[0]).toBe(0);
    expect(attempt.passed).toBe(true);
    expect(attemptFilter.limit).toBe(20);
    expect(createTraining.trainingType).toBe(StatutoryTrainingType.NEW_WORKER);
    expect(updateTraining.trainingType).toBe(StatutoryTrainingType.SPECIAL);
    expect(training.status).toBe(TrainingCompletionStatus.SCHEDULED);
    expect(trainingFilter.status).toBe(TrainingCompletionStatus.EXPIRED);
    expect(createTbm.leaderId).toBe("u1");
    expect(tbmRecord.attendees[0]?.id).toBe("ta1");
    expect(tbmList.attendeeCount).toBe(1);
    expect(tbmFilter.page).toBe(1);
    expect(trendData.count).toBe(3);
    expect(trendFilter.siteId).toBe("s1");
    expect(pointsDistribution.totalAmount).toBe(120);
  });

  it("validates API response envelopes with satisfies", () => {
    const apiResponse = {
      success: true,
      data: { id: "u1" },
      message: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
    } satisfies ApiResponse<{ id: string }>;
    const paginated = {
      success: true,
      data: [{ id: "u1" }],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    } satisfies PaginatedResponse<{ id: string }>;
    const errorResponse = {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "잘못된 요청",
        details: { field: "phone" },
      },
      timestamp: "2026-01-01T00:00:00.000Z",
    } satisfies ErrorResponse;

    expect(apiResponse.success).toBe(true);
    expect(paginated.meta.totalPages).toBe(1);
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error.code).toBe("INVALID_REQUEST");
  });
});
