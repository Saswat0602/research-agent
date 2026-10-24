import { ResearchState, ResearchUpdate } from "../state.js";
import { EvidenceSource } from "../../core/types.js";
import { webSearchTool } from "../../tools/web-search.js";

export async function searchNode(state: ResearchState): Promise<ResearchUpdate> {
  const queriesToRun: string[] = [];

  if (state.review && state.review.nextQueries.length > 0) {
    queriesToRun.push(...state.review.nextQueries.slice(0, 2));
  } else if (state.plan && state.plan.initialQueries.length > 0) {
    queriesToRun.push(...state.plan.initialQueries.slice(0, 2));
  } else {
    queriesToRun.push(state.topic);
  }

  const collectedEvidence: EvidenceSource[] = [];

  for (const query of queriesToRun) {
    try {
      const toolOutput = await webSearchTool.invoke({ query });
      const parsed = JSON.parse(toolOutput) as EvidenceSource[];
      if (Array.isArray(parsed)) {
        collectedEvidence.push(...parsed);
      }
    } catch (err) {
      console.warn(`Search failed for query "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  return {
    evidence: collectedEvidence,
  };
}
