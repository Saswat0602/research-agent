# REVIEWSAGE AI // Autonomous Deep Research Agent Platform

> An enterprise-grade, state-driven multi-agent research platform designed to investigate complex inquiries, gather live web evidence, query private RAG knowledge, deterministically verify citations, and track execution telemetry with durable PostgreSQL checkpoints.

---

## 🌟 What Is This Platform?

Instead of relying on a single LLM prompt that may hallucinate links, invent facts, or miss critical nuance, this platform operates as a **coordinated multi-agent pipeline** built on **LangGraph.js**, **Google Gemini**, and local **Ollama**:

1. 🎯 **The Planner Node**: Formulates deep search hypotheses, focus areas, and targeted queries.
2. 🔎 **The Hybrid Searcher Node**: Queries live web sources (with SSRF protection) and internal private knowledge documents (with overlapping chunking and relevance ranking).
3. ⚖️ **The Reviewer Node**: Evaluates evidence sufficiency, detects gaps, and conditionally orders follow-up search loops (up to a bounded limit).
4. 🛡️ **The Deterministic Citation Gate**: A non-LLM ground-truth validator that strictly verifies every claim URL against collected evidence and checks excerpt containment. Fabricated claims and phantom links are purged before report synthesis.
5. 📄 **The Reporter Node**: Synthesizes a structured executive report with verifiable citation badges.
6. 💾 **Durable State & Observability**: Every step is checkpointed into **PostgreSQL** (`@langchain/langgraph-checkpoint-postgres`), cached in **Redis**, and tracked with exact prompt/completion token logs and cost accounting.

---

## 🏗️ Architecture & Engineering Patterns

The platform adheres to **Hexagonal / Clean Architecture** and proven production engineering patterns:

```
                      ┌────────────────────────────────────────┐
                      │    Web Command Center & REST API       │
                      │       (http://localhost:3001)          │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼────────────────────────┐
                 │       Application & Orchestration Layer        │
                 │   - ResearchService (Use Case Orchestrator)    │
                 │   - ResearchJobQueue (Async Event Dispatcher)  │
                 │   - PromptRegistry (Dynamic Persona Studio)    │
                 └───────────────────────┬────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
 ┌──────▼───────┐               ┌────────▼────────┐              ┌────────▼───────┐
 │ LangGraph.js │               │ Resilient LLM   │              │   Retrieval    │
 │ State Machine│               │ Provider Router │              │   & Security   │
 │ (Checkpointed│               │ (Circuit Breaker│              │ (SSRF Shield + │
 │  in Postgres)│               │  + Fallback)    │              │  Private RAG)  │
 └──────┬───────┘               └────────┬────────┘              └────────┬───────┘
        │                                │                                │
 ┌──────▼────────────────────────────────▼────────────────────────────────▼───────┐
 │                         Infrastructure & Storage                               │
 │   - PostgreSQL (Checkpoints, Sessions, Activity Logs, Token Accounting)        │
 │   - Redis (Query Caching & SSE Event Streams)                                  │
 │   - LLMs: Gemini 3.5 Flash Lite, Ollama Qwen3:8b, Claude 3.5, OpenAI GPT-4o   │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### Key Production Patterns:
- **Chain of Responsibility / Provider Fallback**: If the primary LLM (e.g. Gemini) encounters a rate limit (429) or transient error, the gateway automatically falls back to an alternate provider (e.g. local Ollama or Claude).
- **Circuit Breaker Pattern**: `CircuitBreaker` (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF_OPEN`) prevents cascade failures on downstream LLM APIs and external search engines.
- **Deterministic Citation Verification**: Zero-hallucination guarantee through non-LLM substring search and URL domain validation.
- **RAG Chunking & Relevance Scoring**: Documents are split into overlapping character chunks with term frequency and title bonus scoring.
- **SSRF Defense**: Strict IP subnet filter blocking loopback, cloud metadata (`169.254.169.254`, `metadata.google.internal`), and RFC 1918 private ranges.

---

## 💻 Web Command Center

The platform features a modern, glassmorphism dark-theme Web Application served at `http://localhost:3001`:

- **⚡ Autonomous Research Studio**: Enter research hypotheses, select models (Gemini, Ollama, Claude, OpenAI), set max iteration loops, and watch live graph state animations and SSE log streams.
- **📚 Private Knowledge (RAG) Studio**: Ingest internal documents with automatic chunking and test retrieval relevance with live search queries.
- **📊 Telemetry & Circuit Breakers**: Real-time inspection of token costs, session totals, and circuit breaker health statuses with one-click reset.
- **🕒 Checkpoints & History**: Audit trail of prior research runs in PostgreSQL with one-click report reloading.
- **✍️ Prompt Engineering Studio**: Dynamically customize persona instructions and evaluation criteria without server restarts.

---

## 🚀 Quick Start

### 1. Ensure Dependencies & Database are Ready
```bash
# Verify running Postgres & Redis (port 5432 and 6379)
docker ps

# Install dependencies and sync Prisma schema
npm install
npx prisma db push
```

### 2. Run the Automated Unit Test Suite
```bash
npm test
```
*Executes 33 comprehensive unit tests across 11 suites covering security, citation verification, resilience, job queue, RAG chunking, and graph routing in < 700ms.*

### 3. Start the Web Command Center & API Server
```bash
npm run serve
```
Open **[http://localhost:3001](http://localhost:3001)** in your browser.

---

## 📡 REST API & SSE Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, active provider, and timestamp |
| `GET` | `/models` | Available LLM providers and configuration status |
| `POST` | `/api/v1/research` | Synchronous research execution returning JSON report |
| `GET/POST`| `/api/v1/research/stream` | Server-Sent Events (SSE) live progress stream |
| `POST` | `/api/v1/jobs` | Asynchronous background research dispatch |
| `GET` | `/api/v1/jobs/:id` | Status of asynchronous job |
| `GET` | `/api/v1/jobs/:id/events` | SSE event stream for specific background job |
| `GET` | `/api/v1/knowledge` | List indexed internal RAG documents |
| `POST` | `/api/v1/knowledge` | Ingest internal technical document |
| `GET` | `/api/v1/knowledge/search` | Test RAG search relevance against private KB |
| `GET` | `/api/v1/telemetry/overview` | Aggregated session counts, tokens, and cost |
| `GET` | `/api/v1/telemetry/circuit-breakers` | Inspection of resilience circuit breakers |
| `POST`| `/api/v1/telemetry/circuit-breakers/reset` | Reset all circuit breakers to CLOSED |
| `GET` | `/api/v1/prompts` | Read system prompt personas |
| `POST` | `/api/v1/prompts/customize` | Dynamically override agent prompts |
| `GET` | `/api/v1/sessions` | List historical research sessions |
| `GET` | `/api/v1/sessions/:id` | Full session audit trail with activity logs & token usage |

---

## 📊 Database Explorer (Adminer)

- **URL**: [http://localhost:8080](http://localhost:8080)
- **System**: PostgreSQL
- **Server**: `localhost` (or `postgres` if inside docker network)
- **Username**: `postgres`
- **Password**: `postgres`
- **Database**: `research_agent`
