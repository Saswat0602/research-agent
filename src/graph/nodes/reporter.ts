import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ResearchState, ResearchUpdate } from "../state.js";
import { ResearchReport } from "../../core/types.js";
import { createChatModel } from "../../config/model.js";

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function reporterNode(state: ResearchState): Promise<ResearchUpdate> {
  const model = createChatModel({ temperature: 0.2 });
  const evidenceList = state.evidence
    .map((e, idx) => `[Source ${idx + 1}] Title: ${e.title}\nURL: ${e.url}\nContent: ${e.content}`)
    .join("\n\n");

  const systemPrompt = `You are a principal research analyst. Produce an evidence-backed report based strictly on the provided sources.
Return ONLY valid JSON matching this schema:
{
  "topic": "${state.topic.replace(/"/g, '\\"')}",
  "summary": "comprehensive overview of the findings",
  "keyFindings": [
    {
      "claim": "specific factual claim",
      "sourceUrl": "url from evidence",
      "evidenceSnippet": "direct quote or concise excerpt"
    }
  ],
  "sources": [
    {
      "title": "source title",
      "url": "source url"
    }
  ],
  "conclusion": "strategic takeaway and outlook"
}`;

  const userPrompt = `Research Topic: ${state.topic}
Collected Evidence:
${evidenceList || "No external evidence provided."}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const rawText = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

  const fallback: ResearchReport = {
    topic: state.topic,
    summary: `Research synthesis on ${state.topic}.`,
    keyFindings: state.evidence.map((e) => ({
      claim: e.title,
      sourceUrl: e.url,
      evidenceSnippet: e.content.slice(0, 200),
    })),
    sources: state.evidence.map((e) => ({ title: e.title, url: e.url })),
    conclusion: "Research cycle completed with collected evidence.",
    generatedAt: new Date().toISOString(),
    loopsUsed: state.iterationCount,
  };

  const parsed = parseJsonSafe<Partial<ResearchReport>>(rawText, fallback);

  const finalReport: ResearchReport = {
    topic: parsed.topic || state.topic,
    summary: parsed.summary || fallback.summary,
    keyFindings: Array.isArray(parsed.keyFindings) && parsed.keyFindings.length > 0 ? parsed.keyFindings : fallback.keyFindings,
    sources: Array.isArray(parsed.sources) && parsed.sources.length > 0 ? parsed.sources : fallback.sources,
    conclusion: parsed.conclusion || fallback.conclusion,
    generatedAt: new Date().toISOString(),
    loopsUsed: state.iterationCount,
  };

  return {
    finalReport,
  };
}
