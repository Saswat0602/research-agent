import { Router, Request, Response, NextFunction } from "express";
import { researchService } from "../services/research.service.js";
import { researchGraph } from "../graph/research-graph.js";
import { getAppConfig } from "../config/env.js";
import { sessionRepository } from "../db/session.repository.js";
import { prisma } from "../db/client.js";

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

apiRouter.get("/models", (_req: Request, res: Response) => {
  const config = getAppConfig();
  res.json({
    activeProvider: config.MODEL_PROVIDER,
    supportedProviders: ["ollama", "gemini", "google", "openai"],
    ollama: {
      baseUrl: config.OLLAMA_BASE_URL,
      model: config.OLLAMA_MODEL,
    },
    gemini: {
      model: config.GEMINI_MODEL || config.GOOGLE_MODEL,
      configured: Boolean(config.GEMINI_API_KEY || config.GOOGLE_API_KEY),
    },
    openai: {
      model: config.OPENAI_MODEL,
      configured: Boolean(config.OPENAI_API_KEY),
    },
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

apiRouter.post("/research/stream", async (req: Request, res: Response) => {
  const { topic, maxIterations } = req.body as { topic?: string; maxIterations?: number };
  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "Missing or invalid 'topic' in request body" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("start", { topic, maxIterations: maxIterations ?? 3 });

    const result = await researchService.conductResearch(topic, {
      maxIterations,
      onProgress: (step, details) => {
        sendEvent("progress", { step, details });
      },
    });

    sendEvent("complete", result);
    res.end();
  } catch (err) {
    sendEvent("error", { message: err instanceof Error ? err.message : String(err) });
    res.end();
  }
});

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

