import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ResearchJobQueue } from "../../src/jobs/research-queue.js";
import { ResearchReport } from "../../src/core/types.js";

describe("Jobs: ResearchJobQueue Lifecycle", () => {
  it("enqueues a research job without autoStart", async () => {
    const queue = new ResearchJobQueue();
    let eventReceived = false;

    queue.once("job_enqueued", (job) => {
      eventReceived = true;
      assert.equal(job.topic, "Quantum Computing in Finance");
      assert.equal(job.maxIterations, 3);
      assert.equal(job.status, "QUEUED");
    });

    const job = await queue.enqueue("Quantum Computing in Finance", {
      maxIterations: 3,
      autoStart: false,
    });
    assert(job.id.startsWith("job_"));
    assert.equal(job.topic, "Quantum Computing in Finance");
    assert.equal(eventReceived, true);
    assert.equal(job.status, "QUEUED");

    const retrieved = queue.getJob(job.id);
    assert.deepEqual(retrieved, job);
  });

  it("lists multiple jobs in reverse chronological order", async () => {
    const queue = new ResearchJobQueue();
    const job1 = await queue.enqueue("Topic 1", { autoStart: false });
    await new Promise((r) => setTimeout(r, 10));
    const job2 = await queue.enqueue("Topic 2", { autoStart: false });

    const jobs = queue.listJobs();
    assert.equal(jobs.length >= 2, true);
    assert.equal(jobs[0].id, job2.id); // Newer first
    assert.equal(jobs[1].id, job1.id);
  });

  it("executes job using injected worker and transitions to COMPLETED", async () => {
    const mockReport: ResearchReport = {
      topic: "Test Topic",
      summary: "Completed summary",
      keyFindings: [],
      sources: [],
      conclusion: "Test conclusion",
      generatedAt: new Date().toISOString(),
      loopsUsed: 1,
    };

    const mockWorker = async (job: any, onProgress: any) => {
      onProgress("planning", { detail: "ok" });
      return { sessionId: "sess-123", report: mockReport };
    };

    const queue = new ResearchJobQueue(mockWorker);
    const progressEvents: string[] = [];

    const job = await queue.enqueue("Test Topic", { autoStart: false });

    queue.on(`job:${job.id}`, (evt) => {
      if (evt.type === "progress") progressEvents.push(evt.step);
    });

    await queue.processJob(job.id);

    const updated = queue.getJob(job.id);
    assert.equal(updated?.status, "COMPLETED");
    assert.equal(updated?.sessionId, "sess-123");
    assert.deepEqual(updated?.report, mockReport);
    assert.deepEqual(progressEvents, ["planning"]);
  });

  it("handles worker failure and transitions job to FAILED", async () => {
    const failingWorker = async () => {
      throw new Error("Downstream provider timeout");
    };

    const queue = new ResearchJobQueue(failingWorker);
    const job = await queue.enqueue("Failing Topic", { autoStart: false });

    await queue.processJob(job.id);

    const updated = queue.getJob(job.id);
    assert.equal(updated?.status, "FAILED");
    assert.equal(updated?.error, "Downstream provider timeout");
  });
});
