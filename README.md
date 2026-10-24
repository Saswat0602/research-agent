# Autonomous Research Agent Platform

> An enterprise-grade, state-driven research agent platform designed to investigate complex questions, gather live web evidence, verify citations, and track activity & token usage in PostgreSQL.

---

## 🌟 What Is This Project? (For Everyone)

Have you ever asked an AI a question, only to get an outdated answer, a made-up link, or a vague guess? 

This project solves that. Instead of a single model prompt guessing an answer, this system operates like a **team of meticulous human researchers**:

1. 🎯 **The Planner**: Takes your topic, analyzes what information is needed, and formulates specific search queries.
2. 🔍 **The Searcher**: Queries the live web, fetches verified documentation, and collects evidence.
3. 🧐 **The Reviewer**: Evaluates the gathered evidence. If something is missing or unclear, it orders a targeted follow-up search (up to a safe loop limit).
4. 📝 **The Reporter**: Synthesizes a structured, evidence-backed report where **every factual claim links directly to its source URL**.
5. 💾 **The Historian (Database & Telemetry)**: Automatically saves the entire research session, the collected sources, node execution times, and exact token costs into **PostgreSQL** with fast **Redis** search caching.

---

## 🏗️ Architecture & Data Modeling

The platform uses **LangGraph** for cyclical execution, **Prisma ORM** with **PostgreSQL** for durable persistence, and **Redis** for search caching.

### 1. Data Schema
- `research_sessions`: Session metadata, topic, model provider, duration, confidence score, error states.
- `research_plans`: Formulated queries, focus angles, and strategy rationale.
- `evidence_sources`: Canonical source URL, content snippet, query origin, and iteration index.
- `review_assessments`: Sufficiency decision, confidence score, detected missing information, and follow-up queries.
- `research_reports`: Executive summary, conclusion, and relation to itemized findings.
- `report_findings`: Sourced claims linked directly to evidence sources and verified URLs.
- `agent_activity_logs`: Chronological audit trail per node with input/output payloads and latency.
- `token_usage_logs`: Exact prompt tokens, completion tokens, total tokens, and USD cost calculation.

### 2. Multi-Model Support
- **Google Gemini**: Uses `gemini-3.5-flash-lite` or `gemini-3.5-flash` with Google Gen AI SDK.
- **Local Ollama**: Offline private execution using local `qwen3:8b`.
- **OpenAI**: Optional cloud fallback.

---

## 🚀 Quick Start in 3 Steps

### 1. Ensure Services are Running
```bash
# If using the included compose file:
docker compose up -d

# Or verify running Postgres & Redis:
docker ps
```

### 2. Install & Push Schema
```bash
npm install
npx prisma db push
```

### 3. Run a Research Query
```bash
npm start
```

---

## 📡 Microservice Endpoints

Start the API server:
```bash
npm run serve
```
The server runs on `http://localhost:3001`.

- `GET /health`: Health and provider configuration.
- `GET /api/v1/models`: Active model provider status.
- `POST /api/v1/research`: Run a research task and return structured JSON.
- `POST /api/v1/research/stream`: Real-time Server-Sent Events (SSE) streaming progress.
- `GET /api/v1/sessions`: List historical research sessions.
- `GET /api/v1/sessions/:id`: Inspect full session data (report, sources, activity logs, token logs).
- `GET /api/v1/metrics`: Aggregated token usage and cost metrics.

---

## 📊 Visual Database Explorer (Adminer)

- **URL**: [http://localhost:8080](http://localhost:8080)
- **System**: PostgreSQL
- **Server**: `postgres` (or `localhost`)
- **Username**: `postgres`
- **Password**: `postgres`
- **Database**: `research_agent`
