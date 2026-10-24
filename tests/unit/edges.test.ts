import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { shouldContinue } from "../../src/graph/edges.js";
import { ResearchState } from "../../src/graph/state.js";

describe("Graph: Conditional Routing Edges", () => {
  const baseState: ResearchState = {
    topic: "Test Topic",
    messages: [],
    plan: null,
    evidence: [],
    review: null,
    iterationCount: 1,
    maxIterations: 3,
    finalReport: null,
  };

  test("routes to 'reporter' when review indicates evidence is sufficient", () => {
    const state: ResearchState = {
      ...baseState,
      review: {
        isSufficient: true,
        missingInfo: [],
        nextQueries: [],
        confidenceScore: 0.9,
        evaluationNotes: "Sufficient evidence collected",
      },
      iterationCount: 1,
      maxIterations: 3,
    };

    const nextNode = shouldContinue(state);
    assert.equal(nextNode, "reporter");
  });

  test("routes to 'searcher' when evidence is insufficient and loop limit is not reached", () => {
    const state: ResearchState = {
      ...baseState,
      review: {
        isSufficient: false,
        missingInfo: ["Need more details on benchmarks"],
        nextQueries: ["benchmarks query"],
        confidenceScore: 0.4,
        evaluationNotes: "Gaps identified",
      },
      iterationCount: 1,
      maxIterations: 3,
    };

    const nextNode = shouldContinue(state);
    assert.equal(nextNode, "searcher");
  });

  test("routes to 'reporter' when iteration count reaches maxIterations even if insufficient", () => {
    const state: ResearchState = {
      ...baseState,
      review: {
        isSufficient: false,
        missingInfo: ["Still missing some details"],
        nextQueries: ["query"],
        confidenceScore: 0.5,
        evaluationNotes: "Loop bound reached",
      },
      iterationCount: 3,
      maxIterations: 3,
    };

    const nextNode = shouldContinue(state);
    assert.equal(nextNode, "reporter");
  });
});
