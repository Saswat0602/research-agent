import { prisma } from "./client.js";
import { EvidenceSource, ResearchPlan, ReviewAssessment, ResearchReport } from "../core/types.js";
import { SessionStatus } from "@prisma/client";

export class SessionRepository {
  async createSession(data: {
    topic: string;
    modelProvider: string;
    modelName: string;
    maxIterations: number;
    threadId?: string;
  }) {
    return prisma.researchSession.create({
      data: {
        topic: data.topic,
        modelProvider: data.modelProvider,
        modelName: data.modelName,
        maxIterations: data.maxIterations,
        threadId: data.threadId,
        status: SessionStatus.RUNNING,
      },
    });
  }

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    data: { loopsUsed?: number; confidenceScore?: number; error?: string } = {}
  ) {
    return prisma.researchSession.update({
      where: { id: sessionId },
      data: {
        status,
        loopsUsed: data.loopsUsed,
        confidenceScore: data.confidenceScore,
        error: data.error,
        completedAt: status === SessionStatus.COMPLETED || status === SessionStatus.FAILED ? new Date() : undefined,
      },
    });
  }

  async savePlan(sessionId: string, plan: ResearchPlan) {
    return prisma.researchPlan.upsert({
      where: { sessionId },
      create: {
        sessionId,
        initialQueries: plan.initialQueries,
        focusAreas: plan.focusAreas,
        needsExternalSearch: plan.needsExternalSearch,
        rationale: plan.rationale,
      },
      update: {
        initialQueries: plan.initialQueries,
        focusAreas: plan.focusAreas,
        needsExternalSearch: plan.needsExternalSearch,
        rationale: plan.rationale,
      },
    });
  }

  async saveEvidence(sessionId: string, evidence: EvidenceSource[], loopIteration: number) {
    if (evidence.length === 0) return [];

    const operations = evidence.map((item) =>
      prisma.evidenceSource.create({
        data: {
          sessionId,
          title: item.title,
          url: item.url,
          contentSnippet: item.content,
          query: item.query,
          loopIteration,
        },
      })
    );

    return prisma.$transaction(operations);
  }

  async saveReview(sessionId: string, review: ReviewAssessment, iterationNumber: number) {
    return prisma.reviewAssessment.create({
      data: {
        sessionId,
        iterationNumber,
        isSufficient: review.isSufficient,
        confidenceScore: review.confidenceScore,
        missingInfo: review.missingInfo,
        nextQueries: review.nextQueries,
        evaluationNotes: review.evaluationNotes,
      },
    });
  }

  async saveReport(sessionId: string, report: ResearchReport) {
    return prisma.researchReport.create({
      data: {
        sessionId,
        topic: report.topic,
        summary: report.summary,
        conclusion: report.conclusion,
        loopsUsed: report.loopsUsed,
        findings: {
          create: report.keyFindings.map((finding) => ({
            claim: finding.claim,
            sourceUrl: finding.sourceUrl,
            evidenceSnippet: finding.evidenceSnippet,
          })),
        },
      },
      include: {
        findings: true,
      },
    });
  }

  async logActivity(data: {
    sessionId: string;
    nodeName: string;
    eventType: string;
    iteration?: number;
    inputPayload?: unknown;
    outputPayload?: unknown;
    latencyMs?: number;
    errorDetails?: string;
  }) {
    return prisma.agentActivityLog.create({
      data: {
        sessionId: data.sessionId,
        nodeName: data.nodeName,
        eventType: data.eventType,
        iteration: data.iteration ?? 0,
        inputPayload: (data.inputPayload as object) ?? undefined,
        outputPayload: (data.outputPayload as object) ?? undefined,
        latencyMs: data.latencyMs,
        errorDetails: data.errorDetails,
      },
    });
  }

  async logTokenUsage(data: {
    sessionId: string;
    nodeName: string;
    modelProvider: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
    latencyMs?: number;
  }) {
    return prisma.tokenUsageLog.create({
      data: {
        sessionId: data.sessionId,
        nodeName: data.nodeName,
        modelProvider: data.modelProvider,
        modelName: data.modelName,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        estimatedCostUsd: data.estimatedCostUsd,
        latencyMs: data.latencyMs,
      },
    });
  }

  async getSession(sessionId: string) {
    return prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: {
        plan: true,
        report: {
          include: { findings: true },
        },
        evidence: true,
        reviews: true,
        activityLogs: {
          orderBy: { timestamp: "asc" },
        },
        tokenLogs: true,
      },
    });
  }

  async listSessions(limit = 20) {
    return prisma.researchSession.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        report: {
          select: { summary: true, conclusion: true },
        },
        _count: {
          select: { evidence: true, tokenLogs: true, activityLogs: true },
        },
      },
    });
  }
}

export const sessionRepository = new SessionRepository();
