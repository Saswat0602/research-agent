import { EventEmitter } from "node:events";
import { researchService } from "../services/research.service.js";
import { sessionRepository } from "../db/session.repository.js";
import { ResearchReport } from "../core/types.js";

export interface ResearchJob {
  id: string;
  topic: string;
  maxIterations: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  sessionId?: string;
  report?: ResearchReport;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type JobExecutor = (
  job: ResearchJob,
  onProgress: (step: string, details?: unknown) => void
) => Promise<{ sessionId?: string; report?: ResearchReport }>;

export interface EnqueueOptions {
  maxIterations?: number;
  autoStart?: boolean;
}

export class ResearchJobQueue extends EventEmitter {
  private jobs = new Map<string, ResearchJob>();
  private executor: JobExecutor;

  constructor(customExecutor?: JobExecutor) {
    super();
    this.executor =
      customExecutor ??
      (async (job, onProgress) => {
        return researchService.conductResearch(job.topic, {
          maxIterations: job.maxIterations,
          onProgress,
        });
      });
  }

  async enqueue(topic: string, options: EnqueueOptions = {}): Promise<ResearchJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: ResearchJob = {
      id: jobId,
      topic,
      maxIterations: options.maxIterations ?? 3,
      status: "QUEUED",
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.emit("job_enqueued", job);

    if (options.autoStart !== false) {
      // Process asynchronously without blocking HTTP response
      setImmediate(() => this.processJob(jobId));
    }

    return job;
  }

  async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = "RUNNING";
    job.startedAt = new Date();
    this.emit(`job:${jobId}`, { type: "status", status: "RUNNING" });

    try {
      const result = await this.executor(job, (step, details) => {
        this.emit(`job:${jobId}`, { type: "progress", step, details });
      });

      job.status = "COMPLETED";
      job.sessionId = result.sessionId;
      job.report = result.report;
      job.completedAt = new Date();

      this.emit(`job:${jobId}`, {
        type: "completed",
        sessionId: result.sessionId,
        report: result.report,
      });
    } catch (err) {
      job.status = "FAILED";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date();

      this.emit(`job:${jobId}`, {
        type: "failed",
        error: job.error,
      });
    }
  }

  getJob(jobId: string): ResearchJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): ResearchJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}

export const researchJobQueue = new ResearchJobQueue();
