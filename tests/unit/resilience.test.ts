import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  withTimeout,
  withRetry,
  TimeoutError,
  CircuitBreaker,
  CircuitBreakerOpenError,
  RateLimiter,
} from "../../src/core/resilience.js";

describe("Resilience: withTimeout", () => {
  it("resolves quickly without timeout", async () => {
    const result = await withTimeout(Promise.resolve("success"), 500, "fastOp");
    assert.equal(result, "success");
  });

  it("rejects with TimeoutError when operation exceeds threshold", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 200));
    await assert.rejects(
      () => withTimeout(slowPromise, 30, "slowOp"),
      (err: unknown) => {
        assert(err instanceof TimeoutError);
        assert.equal(err.timeoutMs, 30);
        return true;
      }
    );
  });
});

describe("Resilience: withRetry", () => {
  it("returns value on first successful attempt", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      return "immediate";
    });
    assert.equal(result, "immediate");
    assert.equal(attempts, 1);
  });

  it("retries on transient error and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("transient glitch");
        }
        return "eventual success";
      },
      { maxRetries: 4, initialDelayMs: 5, maxDelayMs: 20 }
    );
    assert.equal(result, "eventual success");
    assert.equal(attempts, 3);
  });

  it("exhausts retries and throws the last error", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            attempts++;
            throw new Error("permanent failure");
          },
          { maxRetries: 3, initialDelayMs: 5, maxDelayMs: 20 }
        ),
      /permanent failure/
    );
    assert.equal(attempts, 3);
  });
});

describe("Resilience: CircuitBreaker", () => {
  it("executes calls normally when CLOSED", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    assert.equal(cb.getState(), "CLOSED");
    const res = await cb.execute(async () => 42);
    assert.equal(res, 42);
    assert.equal(cb.getState(), "CLOSED");
  });

  it("trips to OPEN after consecutive failures and fast-fails", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, name: "gemini-api" });

    // Fail 1
    await assert.rejects(() => cb.execute(async () => { throw new Error("500 API Error"); }));
    assert.equal(cb.getState(), "CLOSED");

    // Fail 2 -> Should trip to OPEN
    await assert.rejects(() => cb.execute(async () => { throw new Error("500 API Error"); }));
    assert.equal(cb.getState(), "OPEN");

    // Immediate next call should fail with CircuitBreakerOpenError without running fn
    let called = false;
    await assert.rejects(
      () => cb.execute(async () => { called = true; return "ok"; }),
      (err: unknown) => {
        assert(err instanceof CircuitBreakerOpenError);
        assert.equal(err.circuitName, "gemini-api");
        return true;
      }
    );
    assert.equal(called, false);
  });

  it("transitions to HALF_OPEN after cooldown and recovers to CLOSED on success", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 25, halfOpenSuccessThreshold: 2 });

    await assert.rejects(() => cb.execute(async () => { throw new Error("fail"); }));
    assert.equal(cb.getState(), "OPEN");

    // Wait for reset cooldown
    await new Promise((r) => setTimeout(r, 35));
    assert.equal(cb.getState(), "HALF_OPEN");

    // First trial success
    await cb.execute(async () => "trial-1");
    assert.equal(cb.getState(), "HALF_OPEN");

    // Second trial success -> should close
    await cb.execute(async () => "trial-2");
    assert.equal(cb.getState(), "CLOSED");
  });
});

describe("Resilience: RateLimiter", () => {
  it("allows bursts up to capacity and denies excess", () => {
    const limiter = new RateLimiter(3, 10);
    assert.equal(limiter.tryAcquire(), true);
    assert.equal(limiter.tryAcquire(), true);
    assert.equal(limiter.tryAcquire(), true);
    assert.equal(limiter.tryAcquire(), false); // Exhausted
  });

  it("refills tokens over time", async () => {
    const limiter = new RateLimiter(2, 50); // 50 tokens per second = 1 token per 20ms
    assert.equal(limiter.tryAcquire(2), true);
    assert.equal(limiter.tryAcquire(), false);

    await new Promise((r) => setTimeout(r, 30));
    assert.equal(limiter.tryAcquire(), true);
  });
});
