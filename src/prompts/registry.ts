import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from "./planner.prompt.js";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./reviewer.prompt.js";
import { buildReporterSystemPrompt, buildReporterUserPrompt } from "./reporter.prompt.js";

export class PromptRegistry {
  private customPlannerInstructions?: string;
  private customReviewerCriteria?: string;
  private customReportTone?: string;

  setPlannerInstructions(instructions: string): void {
    this.customPlannerInstructions = instructions;
  }

  setReviewerCriteria(criteria: string): void {
    this.customReviewerCriteria = criteria;
  }

  setReportTone(tone: string): void {
    this.customReportTone = tone;
  }

  getPlannerPrompts(topic: string) {
    return {
      systemPrompt: buildPlannerSystemPrompt({
        topic,
        customInstructions: this.customPlannerInstructions,
      }),
      userPrompt: buildPlannerUserPrompt(topic),
    };
  }

  getReviewerPrompts(topic: string, iteration: number, evidenceSummary: string) {
    return {
      systemPrompt: buildReviewerSystemPrompt({
        customCriteria: this.customReviewerCriteria,
      }),
      userPrompt: buildReviewerUserPrompt({
        topic,
        iteration,
        evidenceSummary,
        customCriteria: this.customReviewerCriteria,
      }),
    };
  }

  getReporterPrompts(topic: string, evidenceList: string) {
    return {
      systemPrompt: buildReporterSystemPrompt({
        topic,
        reportTone: this.customReportTone,
      }),
      userPrompt: buildReporterUserPrompt({
        topic,
        evidenceList,
        reportTone: this.customReportTone,
      }),
    };
  }

  getActiveCustomizations() {
    return {
      plannerInstructions: this.customPlannerInstructions ?? null,
      reviewerCriteria: this.customReviewerCriteria ?? null,
      reportTone: this.customReportTone ?? null,
    };
  }
}

export const promptRegistry = new PromptRegistry();
