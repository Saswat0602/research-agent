import { ResearchState, ResearchUpdate } from "../state.js";
import { EvidenceSource } from "../../core/types.js";
import { webSearchTool } from "../../tools/web-search.js";

import { knowledgeRetriever } from "../../retrieval/retriever.js";

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
    // 1. Check internal private knowledge base first (RAG)
    try {
      const privateDocs = await knowledgeRetriever.queryPrivateKnowledge(query);
      if (privateDocs.length > 0) {
        collectedEvidence.push(...privateDocs);
      }
    } catch (err) {
      console.warn(`[KnowledgeRetriever] Private RAG query failed for "${query}":`, err instanceof Error ? err.message : err);
    }

    // 2. Query external web search
    try {
      const toolOutput = await webSearchTool.invoke({ query });
      const parsed = JSON.parse(toolOutput) as EvidenceSource[];
      if (Array.isArray(parsed)) {
        collectedEvidence.push(...parsed);
      }
    } catch (err) {
      console.warn(`[WebSearch] Search failed for query "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  return {
    evidence: collectedEvidence,
  };
}
