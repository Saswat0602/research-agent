import { StateGraph, START, END, BaseCheckpointSaver, CompiledStateGraph } from "@langchain/langgraph";
import { ResearchStateAnnotation, ResearchState, ResearchUpdate } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { searchNode } from "./nodes/search.js";
import { reviewerNode } from "./nodes/reviewer.js";
import { reporterNode } from "./nodes/reporter.js";
import { shouldContinue } from "./edges.js";
import { getCheckpointer } from "../persistence/checkpointer.js";

export function createGraphBuilder() {
  return new StateGraph(ResearchStateAnnotation)
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
}

type CompiledResearchGraph = ReturnType<ReturnType<typeof createGraphBuilder>["compile"]>;
let defaultCompiledGraph: CompiledResearchGraph | null = null;

export async function getResearchGraph(options: { checkpointer?: BaseCheckpointSaver } = {}) {
  if (!options.checkpointer && defaultCompiledGraph) {
    return defaultCompiledGraph;
  }

  const checkpointer = options.checkpointer ?? (await getCheckpointer());
  const builder = createGraphBuilder();
  const compiled = builder.compile({ checkpointer });

  if (!options.checkpointer) {
    defaultCompiledGraph = compiled;
  }

  return compiled;
}

// Ephemeral graph compiled without checkpointer for fast unit tests
export const ephemeralGraph = createGraphBuilder().compile();
