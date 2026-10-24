import { getResearchGraph } from "../graph/research-graph.js";
import { ResearchReport, ResearchPlan, ReviewAssessment, EvidenceSource } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import { getAppConfig } from "../config/env.js";
import { sessionRepository } from "../db/session.repository.js";
import { SessionStatus } from "@prisma/client";

export interface ResearchRequestOptions {
  maxIterations?: number;
  onProgress?: (step: string, details?: unknown) => void;
}

export interface ResearchExecutionResult {
  sessionId: string;
  report: ResearchReport;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ResearchService {
  async conductResearch(
    topic: string,
    options: ResearchRequestOptions = {}
  ): Promise<ResearchExecutionResult> {
    if (!topic || topic.trim().length === 0) {
      throw new ValidationError("Topic must not be empty");
    }

    const config = getAppConfig();
    const maxIterations = options.maxIterations ?? config.MAX_RESEARCH_LOOPS;
    const modelName =
      config.MODEL_PROVIDER === "gemini" || config.MODEL_PROVIDER === "google"
        ? config.GEMINI_MODEL || config.GOOGLE_MODEL
        : config.MODEL_PROVIDER === "ollama"
        ? config.OLLAMA_MODEL
        : config.OPENAI_MODEL;

    // 1. Create DB session
    const session = await sessionRepository.createSession({
      topic: topic.trim(),
      modelProvider: config.MODEL_PROVIDER,
      modelName,
      maxIterations,
    });

    const sessionId = session.id;
    options.onProgress?.("Starting research workflow", { sessionId, topic, maxIterations });

    let finalReport: ResearchReport | null = null;
    let latestPlan: ResearchPlan | null = null;
    let latestReview: ReviewAssessment | null = null;
    let accumulatedEvidence: EvidenceSource[] = [];
    let currentIteration = 0;

    const sessionStartTime = Date.now();

    try {
      const graph = await getResearchGraph();
      const stream = await graph.stream(
        {
          topic: topic.trim(),
          maxIterations,
          iterationCount: 0,
          evidence: [],
          messages: [],
        },
        {
          streamMode: "updates",
          configurable: { thread_id: sessionId },
        }
      );

      for await (const chunk of stream) {
        const [nodeName, nodeState] = Object.entries(chunk)[0] || [];
        if (!nodeName || !nodeState) continue;

        const nodeStartTime = Date.now();

        if (nodeName === "planner" && (nodeState as { plan?: ResearchPlan }).plan) {
          latestPlan = (nodeState as { plan: ResearchPlan }).plan;
          currentIteration = (nodeState as { iterationCount?: number }).iterationCount ?? 1;

          await sessionRepository.savePlan(sessionId, latestPlan);
          const promptEst = estimateTokens(topic);
          const compEst = estimateTokens(JSON.stringify(latestPlan));

          await sessionRepository.logTokenUsage({
            sessionId,
            nodeName: "planner",
            modelProvider: config.MODEL_PROVIDER,
            modelName,
            promptTokens: promptEst,
            completionTokens: compEst,
            totalTokens: promptEst + compEst,
            estimatedCostUsd: (promptEst * 0.075 + compEst * 0.3) / 1_000_000,
            latencyMs: Date.now() - nodeStartTime,
          });

          await sessionRepository.logActivity({
            sessionId,
            nodeName: "planner",
            eventType: "PLAN_CREATED",
            iteration: currentIteration,
            outputPayload: latestPlan,
            latencyMs: Date.now() - nodeStartTime,
          });

          options.onProgress?.("Research plan formulated", {
            queries: latestPlan.initialQueries,
            focusAreas: latestPlan.focusAreas,
          });
        }

        if (nodeName === "searcher" && (nodeState as { evidence?: EvidenceSource[] }).evidence) {
          const newEvidence = (nodeState as { evidence: EvidenceSource[] }).evidence;
          accumulatedEvidence = [...accumulatedEvidence, ...newEvidence];

          await sessionRepository.saveEvidence(sessionId, newEvidence, currentIteration);
          await sessionRepository.logActivity({
            sessionId,
            nodeName: "searcher",
            eventType: "EVIDENCE_GATHERED",
            iteration: currentIteration,
            outputPayload: { count: newEvidence.length, sources: newEvidence.map((e) => e.title) },
            latencyMs: Date.now() - nodeStartTime,
          });

          options.onProgress?.("Evidence collected", {
            newSources: newEvidence.length,
            totalSources: accumulatedEvidence.length,
          });
        }

        if (nodeName === "reviewer" && (nodeState as { review?: ReviewAssessment }).review) {
          latestReview = (nodeState as { review: ReviewAssessment }).review;
          currentIteration = (nodeState as { iterationCount?: number }).iterationCount ?? currentIteration;

          await sessionRepository.saveReview(sessionId, latestReview, currentIteration);
          const promptEst = estimateTokens(JSON.stringify(accumulatedEvidence));
          const compEst = estimateTokens(JSON.stringify(latestReview));

          await sessionRepository.logTokenUsage({
            sessionId,
            nodeName: "reviewer",
            modelProvider: config.MODEL_PROVIDER,
            modelName,
            promptTokens: promptEst,
            completionTokens: compEst,
            totalTokens: promptEst + compEst,
            estimatedCostUsd: (promptEst * 0.075 + compEst * 0.3) / 1_000_000,
            latencyMs: Date.now() - nodeStartTime,
          });

          await sessionRepository.logActivity({
            sessionId,
            nodeName: "reviewer",
            eventType: latestReview.isSufficient ? "REVIEW_SUFFICIENT" : "REVIEW_REQUIRES_LOOP",
            iteration: currentIteration,
            outputPayload: latestReview,
            latencyMs: Date.now() - nodeStartTime,
          });

          options.onProgress?.("Evidence evaluated", {
            isSufficient: latestReview.isSufficient,
            confidenceScore: latestReview.confidenceScore,
            missingInfo: latestReview.missingInfo,
          });
        }

        if (nodeName === "reporter" && (nodeState as { finalReport?: ResearchReport }).finalReport) {
          finalReport = (nodeState as { finalReport: ResearchReport }).finalReport;

          await sessionRepository.saveReport(sessionId, finalReport);
          const promptEst = estimateTokens(JSON.stringify(accumulatedEvidence));
          const compEst = estimateTokens(JSON.stringify(finalReport));

          await sessionRepository.logTokenUsage({
            sessionId,
            nodeName: "reporter",
            modelProvider: config.MODEL_PROVIDER,
            modelName,
            promptTokens: promptEst,
            completionTokens: compEst,
            totalTokens: promptEst + compEst,
            estimatedCostUsd: (promptEst * 0.075 + compEst * 0.3) / 1_000_000,
            latencyMs: Date.now() - nodeStartTime,
          });

          await sessionRepository.logActivity({
            sessionId,
            nodeName: "reporter",
            eventType: "REPORT_SYNTHESIZED",
            iteration: currentIteration,
            outputPayload: { findingsCount: finalReport.keyFindings.length },
            latencyMs: Date.now() - nodeStartTime,
          });
        }
      }

      if (!finalReport) {
        throw new Error("Research workflow finished without generating a final report");
      }

      await sessionRepository.updateSessionStatus(sessionId, SessionStatus.COMPLETED, {
        loopsUsed: finalReport.loopsUsed,
        confidenceScore: latestReview?.confidenceScore ?? 0.85,
      });

      options.onProgress?.("Research completed successfully", {
        sessionId,
        loopsUsed: finalReport.loopsUsed,
        totalDurationMs: Date.now() - sessionStartTime,
      });

      return {
        sessionId,
        report: finalReport,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await sessionRepository.updateSessionStatus(sessionId, SessionStatus.FAILED, {
        error: errorMessage,
      });
      await sessionRepository.logActivity({
        sessionId,
        nodeName: "workflow",
        eventType: "EXECUTION_FAILED",
        errorDetails: errorMessage,
      });
      throw err;
    }
  }
}

export const researchService = new ResearchService();
