import { ResearchState } from "./state.js";

export function shouldContinue(state: ResearchState): "reporter" | "searcher" {
  const isSufficient = state.review?.isSufficient ?? false;
  const reachedMaxIterations = state.iterationCount >= state.maxIterations;

  if (isSufficient || reachedMaxIterations) {
    return "reporter";
  }

  return "searcher";
}
