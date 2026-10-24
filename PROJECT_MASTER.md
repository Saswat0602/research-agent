# Project Master Specification: Production AI Research Agent

## 1. System Vision & Purpose

The **Research Agent** is an enterprise-grade autonomous research platform built with TypeScript, LangGraph, and LangChain. Its core mission is to accept an open-ended, complex research inquiry, formulate a multi-angle research strategy, query external and internal information sources, critically evaluate evidence for relevance and contradictions, and synthesize a traceable, evidence-grounded report where every material claim is anchored to a verified citation.

---

## 2. Architectural Blueprint & Component Boundaries

The system enforces modular separation of concerns:

```
research-agent/
├── src/
│   ├── config/           # Centralized environment validation (Zod)
│   ├── models/           # Provider-agnostic model factory & capability probes (Gemini / Ollama)
│   ├── tools/            # Security-hardened tool integrations (SSRF-safe Web Search, Registry)
│   ├── retrieval/        # Private knowledge base & RAG interfaces
│   ├── core/             # Typed domain contracts (Evidence, Plan, Report, Errors)
│   ├── graph/            # LangGraph State machine, nodes, routing, and checkpointing
│   │   ├── state.ts      # Explicit State channels & reducers
│   │   ├── nodes/        # Single-responsibility agents (Planner, Searcher, Reviewer, Reporter)
│   │   └── edges.ts      # Deterministic loop termination & conditional routing
│   ├── persistence/      # Application DB (Prisma/PostgreSQL) & Workflow Checkpointing
│   ├── api/              # HTTP REST / SSE streaming server (Express)
│   └── observability/    # Audit logging, node latencies, and token cost telemetry
├── tests/
│   ├── unit/             # Routing, schema validation, citation verifier
│   ├── integration/      # Provider adapters, search tools, Prisma persistence
│   └── adversarial/      # Prompt injection defense, hallucination trapping, SSRF blocks
├── prisma/               # Database schema migrations & client generation
├── docker-compose.yml    # PostgreSQL, Redis, and Adminer local orchestration
└── Dockerfile            # Production multi-stage container
```

---

## 3. Mandatory Engineering & Security Invariants

### A. Untrusted External Data & Prompt Injection Defense
- External web pages, retrieved documents, and tool outputs are **data**, never system instructions.
- All untrusted text injected into prompts must be enclosed within explicit `<external_untrusted_data>` fences.
- The agent loop has zero access to arbitrary shell execution or unrestricted local file writes.

### B. Anti-Hallucination & Citation Integrity
- **No Fabricated Citations**: Final reports must only cite URLs present in verified `EvidenceSource` records.
- **Deterministic Citation Verifier**: Before returning a report, an independent validation step cross-checks every cited claim against the retrieved excerpt. Unsubstantiated claims are flagged or omitted.
- **Snippet Distinction**: A search snippet must never be represented as a full-page review.

### C. SSRF & Network Guardrails
- Tool fetches must block loopback (`127.0.0.1`, `localhost`), link-local (`169.254.169.254`), and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Max payload sizes and request timeouts are strictly enforced.

### D. Workflow Boundedness & Resilience
- Bounded loop iteration cap (`MAX_RESEARCH_LOOPS`, default: 3).
- Loop stagnation detection: if consecutive loops yield zero novel evidence, terminate early with a qualified report.
- Checkpointing: Workflows persist execution state allowing safe resume on interruption.

---

## 4. Multi-Provider Strategy

| Provider | Model | Primary Use Case | Capability Contract |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-3.5-flash-lite` / `gemini-3.5-flash` | Production Cloud Inference | Native Tool Calling, Fast Structured JSON Output |
| **Ollama** | `qwen3:8b` | Local Private Inference | Edge Execution, Zero API Cost, Offline Privacy |

---

## 5. Incremental Delivery Milestones

1. **Milestone 1 (Current Baseline)**: Working vertical slice with LangGraph, Gemini 3.5 / Ollama provider factory, PostgreSQL persistence, and Redis cache.
2. **Milestone 2 (Hardening & Quality)**: Automated unit, integration, and adversarial test suite; deterministic citation verifier; SSRF defense for search tools.
3. **Milestone 3 (Resilient Checkpointing & RAG)**: LangGraph durable checkpointing for resumable workflows; local vector knowledge base integration.
4. **Milestone 4 (Full-Stack UI & Production Deployment)**: Next.js frontend with live streaming graph visualizer; containerized deployment with health checks.
