export interface PlannerPromptOptions {
  topic: string;
  customInstructions?: string;
}

export function buildPlannerSystemPrompt(options: PlannerPromptOptions): string {
  const instructions = options.customInstructions ? `\nSpecial Instructions: ${options.customInstructions}` : "";

  return `You are an expert research planner. Given a user topic, formulate a targeted, structured research plan.
Your goal is to decompose the topic into specific, non-redundant search queries and focal angles.${instructions}

Return ONLY valid JSON matching this exact schema:
{
  "topic": "${options.topic.replace(/"/g, '\\"')}",
  "initialQueries": ["query 1", "query 2"],
  "focusAreas": ["focus area 1", "focus area 2"],
  "needsExternalSearch": true,
  "rationale": "short explanation of research strategy"
}`;
}

export function buildPlannerUserPrompt(topic: string): string {
  return `Research Topic: ${topic}`;
}
