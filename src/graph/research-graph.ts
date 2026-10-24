import { StateGraph, START, END } from "@langchain/langgraph";
import { ResearchStateAnnotation } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { searchNode } from "./nodes/search.js";
import { reviewerNode } from "./nodes/reviewer.js";
import { reporterNode } from "./nodes/reporter.js";
import { shouldContinue } from "./edges.js";

export function buildResearchGraph() {
  const workflow = new StateGraph(ResearchStateAnnotation)
    .addNode("planner", plannerNode)
    .addNode("searcher", searchNode)
    .addNode("reviewer", reviewerNode)
    .addNode("reporter", reporterNode)
    .addEdge(START, "planner")
    .addEdge("planner", "searcher")
    .addEdge("searcher", "reviewer")
    .addConditionalEdges("reviewer", shouldContinue, {
      reporter: "reporter",
      searcher: "searcher",
    })
    .addEdge("reporter", END);

  return workflow.compile();
}

export const researchGraph = buildResearchGraph();
