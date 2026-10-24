import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { EvidenceSource, ResearchPlan, ReviewAssessment, ResearchReport } from "../core/types.js";

export const ResearchStateAnnotation = Annotation.Root({
  topic: Annotation<string>(),
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  plan: Annotation<ResearchPlan | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  evidence: Annotation<EvidenceSource[]>({
    reducer: (prev, next) => {
      const seen = new Set(prev.map((e) => e.url));
      const added = next.filter((e) => !seen.has(e.url));
      return [...prev, ...added];
    },
    default: () => [],
  }),
  review: Annotation<ReviewAssessment | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  iterationCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 3,
  }),
  finalReport: Annotation<ResearchReport | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type ResearchState = typeof ResearchStateAnnotation.State;
export type ResearchUpdate = typeof ResearchStateAnnotation.Update;
