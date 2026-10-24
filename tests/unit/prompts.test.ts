import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PromptRegistry } from "../../src/prompts/registry.js";

describe("Prompts: Dynamic Prompt Customization & Registry", () => {
  test("generates default structured prompts for planner, reviewer, and reporter", () => {
    const registry = new PromptRegistry();
    const planner = registry.getPlannerPrompts("Quantum Computing in 2026");

    assert.ok(planner.systemPrompt.includes("Quantum Computing in 2026"));
    assert.ok(planner.systemPrompt.includes("initialQueries"));
    assert.ok(planner.userPrompt.includes("Quantum Computing in 2026"));

    const reviewer = registry.getReviewerPrompts("Quantum Computing in 2026", 1, "Evidence excerpt");
    assert.ok(reviewer.systemPrompt.includes("isSufficient"));
    assert.ok(reviewer.userPrompt.includes("<external_untrusted_evidence>"));

    const reporter = registry.getReporterPrompts("Quantum Computing in 2026", "Source 1");
    assert.ok(reporter.systemPrompt.includes("keyFindings"));
    assert.ok(reporter.systemPrompt.includes("Never invent or hallucinate URLs"));
  });

  test("allows customizing persona instructions, criteria, and tone", () => {
    const registry = new PromptRegistry();
    registry.setPlannerInstructions("Focus specifically on commercial hardware and error correction.");
    registry.setReviewerCriteria("Require at least 3 independent experimental sources.");
    registry.setReportTone("Executive briefing for CTOs.");

    const planner = registry.getPlannerPrompts("Quantum Computing");
    assert.ok(planner.systemPrompt.includes("Focus specifically on commercial hardware and error correction."));

    const reviewer = registry.getReviewerPrompts("Quantum Computing", 1, "Evidence");
    assert.ok(reviewer.systemPrompt.includes("Require at least 3 independent experimental sources."));

    const reporter = registry.getReporterPrompts("Quantum Computing", "Evidence");
    assert.ok(reporter.systemPrompt.includes("Executive briefing for CTOs."));

    const customizations = registry.getActiveCustomizations();
    assert.equal(customizations.reportTone, "Executive briefing for CTOs.");
  });
});
