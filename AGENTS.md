# Agent Specifications, Contracts & Operating Invariants

This document establishes the architectural contracts, behavioral invariants, and security boundaries governing the AI agents in this system.

---

## 1. Multi-Agent Topology & Contracts

```
[START] ──> (planner) ──> (searcher) ──> (reviewer) ──[isSufficient || maxLoops?]
                              ▲               │
                              │           (No, Loop < max)
                              └─── (searcher) ┘
                                      │
                                    (Yes)
                                      ▼
                                 (reporter) ──> [END]
```

| Agent Node | Primary Role | Inputs | Outputs | Verification & Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **Planner** | Research decomposition & strategy | `topic: string` | `ResearchPlan` | Bounded queries (max 4), explicit focus angles, validated JSON schema. |
| **Searcher** | Targeted tool execution & retrieval | `queries: string[]` | `EvidenceSource[]` | SSRF-safe URL resolution, domain sanity check, deduplication by canonical URL. |
| **Reviewer** | Critical evaluation & gap analysis | `evidence: EvidenceSource[]`, `topic: string` | `ReviewAssessment` | Evaluates sufficiency, flags contradictions, bounded loop count (`iterationCount < maxIterations`). |
| **Reporter** | Sourced report synthesis | `evidence: EvidenceSource[]`, `topic: string` | `ResearchReport` | Strict citation verifier: every factual claim MUST trace to a retrieved source URL. |

---

## 2. Core Behavioral Invariants

### 2.1 Untrusted External Data & Prompt Injection Defense
- **Data vs. Instructions**: All external web pages, search snippets, and tool outputs are strictly treated as **untrusted data**.
- **Prompt Fencing**: Retrieved text is wrapped in `<external_untrusted_data>` delimiters with explicit system instructions prohibiting tool escalation or objective hijacking.
- **Least Privilege**: The agent has no access to arbitrary shell execution or destructive system calls.

### 2.2 Anti-Hallucination & Citation Integrity
- **Traceable Citations**: No claims may cite memory or non-existent URLs.
- **Deterministic Verification**: Before report emission, the citation verifier validates:
  1. `sourceUrl` exists in `state.evidence`.
  2. `evidenceSnippet` is a substring or semantic match of the retrieved evidence.
- **Qualified Abstention**: If gathered evidence is insufficient or contradictory, the agent must explicitly state the uncertainty rather than fabricating confidence.

### 2.3 Workflow Boundedness & Resource Guardrails
- **Hard Iteration Cap**: Every workflow execution is bounded by `maxIterations` (default: 3 loops).
- **Stagnation Break**: If an iteration returns 0 novel evidence items, the loop immediately terminates and routes to the Reporter.

---

## 3. Definition of Done for Agent Nodes

A node is considered complete and production-compliant only if:
1. It validates incoming state channels using TypeScript types.
2. It validates LLM outputs with runtime schema parsing (Zod).
3. It logs activity and token telemetry into PostgreSQL (`AgentActivityLog` and `TokenUsageLog`).
4. It includes automated unit tests covering both happy path and adversarial/failure cases.
