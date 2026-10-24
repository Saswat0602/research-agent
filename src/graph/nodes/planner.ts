import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ResearchState, ResearchUpdate } from "../state.js";
import { ResearchPlan } from "../../core/types.js";
import { createChatModel } from "../../config/model.js";

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function plannerNode(state: ResearchState): Promise<ResearchUpdate> {
  const model = createChatModel({ temperature: 0.1 });
  const topic = state.topic;

  const systemPrompt = `You are an expert research planner. Given a user topic, formulate a structured research plan.
Return ONLY valid JSON matching this schema:
{
  "topic": "${topic.replace(/"/g, '\\"')}",
  "initialQueries": ["query1", "query2"],
  "focusAreas": ["area1", "area2"],
  "needsExternalSearch": true,
  "rationale": "short explanation of research strategy"
}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Research Topic: ${topic}`),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

  const fallback: ResearchPlan = {
    topic,
    initialQueries: [topic, `${topic} recent developments`],
    focusAreas: ["Current state", "Key capabilities", "Impact and tradeoffs"],
    needsExternalSearch: true,
    rationale: "Default search strategy formulated for topic",
  };

  const plan = parseJsonSafe<ResearchPlan>(rawText, fallback);

  return {
    plan: {
      topic: plan.topic || topic,
      initialQueries: Array.isArray(plan.initialQueries) && plan.initialQueries.length > 0 ? plan.initialQueries : fallback.initialQueries,
      focusAreas: Array.isArray(plan.focusAreas) && plan.focusAreas.length > 0 ? plan.focusAreas : fallback.focusAreas,
      needsExternalSearch: plan.needsExternalSearch ?? true,
      rationale: plan.rationale || fallback.rationale,
    },
    iterationCount: state.iterationCount + 1,
  };
}
