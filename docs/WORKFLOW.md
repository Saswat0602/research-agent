# Agent Workflow & State Machine

## The Research Graph

The research system models an autonomous investigator through a stateful directed acyclic/cyclical graph managed by LangGraph.

```
       +------------------+
       |      START       |
       +--------+---------+
                |
                v
       +------------------+
       |   Planner Node   | <--- Analyzes topic and formulates target queries
       +--------+---------+
                |
                v
+----> +------------------+
|      |   Searcher Node  | <--- Executes tool queries & gathers evidence
|      +--------+---------+
|               |
|               v
|      +------------------+
|      |  Reviewer Node   | <--- Assesses sufficiency, finds gaps & next queries
|      +--------+---------+
|               |
|     [isSufficient || maxLoops?]
|               |
|          +----+----+
|          |         |
|      (No)|         |(Yes)
+----------+         v
       +------------------+
       |  Reporter Node   | <--- Synthesizes evidence into sourced final report
       +--------+---------+
                |
                v
       +------------------+
       |       END        |
       +------------------+
```

## Step Details

### 1. Planner (`plannerNode`)
- Analyzes the input topic.
- Determines whether external research is required.
- Formulates initial search queries and focal angles.
- Sets the initial research plan.

### 2. Searcher (`searchNode`)
- Runs queries formulated by the planner (or reviewer in subsequent iterations).
- Calls the `web_search` tool.
- Deduplicates new evidence by URL and appends it to the shared state channel.

### 3. Reviewer (`reviewerNode`)
- Scans all accumulated evidence against the research topic.
- Evaluates evidence coverage and assigns a confidence score.
- If gaps are identified and iteration limit is not exceeded, generates follow-up queries.
- Sets `isSufficient: true | false`.

### 4. Reporter (`reporterNode`)
- Consolidates all verified sources.
- Drafts an executive summary, itemized key findings linked directly to source URLs, and strategic conclusions.
- Attaches execution metadata (loops used, timestamp).
