import { Router, Request, Response, NextFunction } from "express";
import { researchService } from "../services/research.service.js";
import { getResearchGraph } from "../graph/research-graph.js";
import { getAppConfig } from "../config/env.js";
import { sessionRepository } from "../db/session.repository.js";
import { prisma } from "../db/client.js";
import { knowledgeRetriever } from "../retrieval/retriever.js";
import { researchJobQueue } from "../jobs/research-queue.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req: Request, res: Response) => {
  const config = getAppConfig();
  res.json({
    status: "ok",
    provider: config.MODEL_PROVIDER,
    model:
      config.MODEL_PROVIDER === "ollama"
        ? config.OLLAMA_MODEL
        : config.MODEL_PROVIDER === "gemini" || config.MODEL_PROVIDER === "google"
        ? (config.GEMINI_MODEL || config.GOOGLE_MODEL)
        : config.OPENAI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

import { circuitBreakerRegistry } from "../core/resilience.js";

apiRouter.get("/telemetry/circuit-breakers", (_req: Request, res: Response) => {
  res.json({
    breakers: circuitBreakerRegistry.getAllMetrics(),
  });
});

apiRouter.post("/telemetry/circuit-breakers/reset", (_req: Request, res: Response) => {
  circuitBreakerRegistry.resetAll();
  res.json({ success: true, message: "All circuit breakers reset to CLOSED" });
});

apiRouter.get("/telemetry/overview", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await sessionRepository.getTelemetryOverview();
    res.json({ success: true, telemetry: overview });
  } catch (err) {
    next(err);
  }
});

import { promptRegistry } from "../prompts/registry.js";

apiRouter.get("/models", (_req: Request, res: Response) => {
  const config = getAppConfig();
  res.json({
    activeProvider: config.MODEL_PROVIDER,
    supportedProviders: [
      "gemini",
      "google",
      "ollama",
      "openai",
      "openrouter",
      "claude",
      "anthropic",
      "bedrock",
      "google-adk",
    ],
    gemini: {
      model: config.GEMINI_MODEL || config.GOOGLE_MODEL,
      configured: Boolean(config.GEMINI_API_KEY || config.GOOGLE_API_KEY),
    },
    ollama: {
      baseUrl: config.OLLAMA_BASE_URL,
      model: config.OLLAMA_MODEL,
    },
    openai: {
      model: config.OPENAI_MODEL,
      configured: Boolean(config.OPENAI_API_KEY),
    },
    openrouter: {
      model: config.OPENROUTER_MODEL,
      configured: Boolean(config.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY),
    },
    claude: {
      model: config.ANTHROPIC_MODEL,
      configured: Boolean(config.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY),
    },
  });
});

apiRouter.get("/prompts", (_req: Request, res: Response) => {
  res.json({
    success: true,
    activeCustomizations: promptRegistry.getActiveCustomizations(),
  });
});

apiRouter.post("/prompts/customize", (req: Request, res: Response) => {
  const { plannerInstructions, reviewerCriteria, reportTone } = req.body as {
    plannerInstructions?: string;
    reviewerCriteria?: string;
    reportTone?: string;
  };

  if (typeof plannerInstructions === "string") promptRegistry.setPlannerInstructions(plannerInstructions);
  if (typeof reviewerCriteria === "string") promptRegistry.setReviewerCriteria(reviewerCriteria);
  if (typeof reportTone === "string") promptRegistry.setReportTone(reportTone);

  res.json({
    success: true,
    activeCustomizations: promptRegistry.getActiveCustomizations(),
  });
});

apiRouter.post("/research", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, maxIterations } = req.body as { topic?: string; maxIterations?: number };
    if (!topic || typeof topic !== "string") {
      res.status(400).json({ error: "Missing or invalid 'topic' in request body" });
      return;
    }

    const report = await researchService.conductResearch(topic, { maxIterations });
    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

const handleResearchStream = async (req: Request, res: Response) => {
  const topic = (req.method === "POST" ? req.body?.topic : req.query?.topic) as string | undefined;
  const maxIterations = Number(req.method === "POST" ? req.body?.maxIterations : req.query?.maxIterations) || 3;

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    res.status(400).json({ error: "Missing or invalid 'topic'" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("status", { step: "Starting research workflow", details: { topic, maxIterations } });

    const result = await researchService.conductResearch(topic, {
      maxIterations,
      onProgress: (step, details) => {
        sendEvent("status", { step, details });
      },
    });

    sendEvent("completed", result);
    res.end();
  } catch (err) {
    sendEvent("error", { message: err instanceof Error ? err.message : String(err) });
    res.end();
  }
};

apiRouter.get("/research/stream", handleResearchStream);
apiRouter.post("/research/stream", handleResearchStream);

apiRouter.get("/sessions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await sessionRepository.listSessions(50);
    res.json({ success: true, count: sessions.length, sessions });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = String(req.params.id);
    const session = await sessionRepository.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/metrics", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalSessions, completedSessions, tokenAggregates] = await Promise.all([
      prisma.researchSession.count(),
      prisma.researchSession.count({ where: { status: "COMPLETED" } }),
      prisma.tokenUsageLog.aggregate({
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          estimatedCostUsd: true,
        },
        _avg: {
          latencyMs: true,
        },
      }),
    ]);

    res.json({
      success: true,
      metrics: {
        totalSessions,
        completedSessions,
        totalTokens: tokenAggregates._sum.totalTokens ?? 0,
        promptTokens: tokenAggregates._sum.promptTokens ?? 0,
        completionTokens: tokenAggregates._sum.completionTokens ?? 0,
        estimatedTotalCostUsd: Number((tokenAggregates._sum.estimatedCostUsd ?? 0).toFixed(6)),
        averageNodeLatencyMs: Math.round(tokenAggregates._avg.latencyMs ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Knowledge Base (Private RAG) Endpoints
apiRouter.post("/knowledge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, sourceUrl, tags, metadata } = req.body as {
      title?: string;
      content?: string;
      sourceUrl?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    };

    if (!title || !content) {
      res.status(400).json({ error: "Title and content are required" });
      return;
    }

    const doc = await knowledgeRetriever.ingestDocument({
      title,
      content,
      sourceUrl,
      tags,
      metadata,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/knowledge", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documents = await knowledgeRetriever.listDocuments();
    res.json({ success: true, count: documents.length, documents });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/knowledge/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "");
    const results = await knowledgeRetriever.queryPrivateKnowledge(q, 5);
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    next(error);
  }
});

// Asynchronous Job Queue Endpoints
apiRouter.post("/jobs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, maxIterations } = req.body as { topic?: string; maxIterations?: number };
    if (!topic || typeof topic !== "string") {
      res.status(400).json({ error: "Missing or invalid 'topic' in request body" });
      return;
    }

    const job = await researchJobQueue.enqueue(topic, { maxIterations });
    res.status(202).json({
      success: true,
      message: "Research job queued successfully",
      jobId: job.id,
      status: job.status,
      links: {
        status: `/api/v1/jobs/${job.id}`,
        events: `/api/v1/jobs/${job.id}/events`,
      },
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/jobs/:id", (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const job = researchJobQueue.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ success: true, job });
});

apiRouter.get("/jobs/:id/events", (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const job = researchJobQueue.getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("job_status", { jobId, status: job.status });

  if (job.status === "COMPLETED") {
    sendEvent("completed", { sessionId: job.sessionId, report: job.report });
    res.end();
    return;
  }

  if (job.status === "FAILED") {
    sendEvent("failed", { error: job.error });
    res.end();
    return;
  }

  const listener = (data: unknown) => {
    sendEvent("update", data);
    if (data && typeof data === "object" && "type" in data && (data.type === "completed" || data.type === "failed")) {
      researchJobQueue.off(`job:${jobId}`, listener);
      res.end();
    }
  };

  researchJobQueue.on(`job:${jobId}`, listener);

  req.on("close", () => {
    researchJobQueue.off(`job:${jobId}`, listener);
  });
});

