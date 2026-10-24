import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ResearchState, ResearchUpdate } from "../state.js";
import { ReviewAssessment } from "../../core/types.js";
import { createChatModel } from "../../config/model.js";

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function reviewerNode(state: ResearchState): Promise<ResearchUpdate> {
  const model = createChatModel({ temperature: 0.1 });
  const evidenceSummary = state.evidence
    .map((e, idx) => `[Source ${idx + 1}] Title: ${e.title}\nURL: ${e.url}\nExcerpt: ${e.content}`)
    .join("\n\n");

  const systemPrompt = `You are a critical research evaluator. Determine if the gathered evidence is sufficient to provide a detailed, accurate report on the research topic.
Return ONLY valid JSON matching this schema:
{
  "isSufficient": true,
  "missingInfo": [],
  "nextQueries": [],
  "confidenceScore": 0.9,
  "evaluationNotes": "short review rationale"
}
If information is insufficient or missing key angles, set "isSufficient": false, list the missing points, and suggest 1-2 new targeted search queries.`;

  const userPrompt = `Research Topic: ${state.topic}
Current Iteration: ${state.iterationCount}
Gathered Evidence:
${evidenceSummary || "No evidence collected yet."}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

  const fallback: ReviewAssessment = {
    isSufficient: state.evidence.length >= 2,
    missingInfo: [],
    nextQueries: [`${state.topic} in-depth analysis`],
    confidenceScore: state.evidence.length >= 2 ? 0.85 : 0.5,
    evaluationNotes: "Evaluated evidence density and relevance",
  };

  const review = parseJsonSafe<ReviewAssessment>(rawText, fallback);

  return {
    review: {
      isSufficient: review.isSufficient ?? fallback.isSufficient,
      missingInfo: Array.isArray(review.missingInfo) ? review.missingInfo : fallback.missingInfo,
      nextQueries: Array.isArray(review.nextQueries) ? review.nextQueries : fallback.nextQueries,
      confidenceScore: typeof review.confidenceScore === "number" ? review.confidenceScore : fallback.confidenceScore,
      evaluationNotes: review.evaluationNotes || fallback.evaluationNotes,
    },
    iterationCount: state.iterationCount + 1,
  };
}
