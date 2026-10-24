# Architecture Specification

## Overview

The Research Agent is built using a provider-agnostic, modular service architecture designed for scalability, reliability, and maintainability. It orchestrates intelligent web research, iterative evidence evaluation, and sourced report synthesis using LangGraph and LangChain.

```
+-------------------------------------------------------------------+
|                        Client Layer                               |
|          CLI Entrypoint  /  REST API  /  Background Worker         |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                        Service Layer                              |
|                       ResearchService                             |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                       LangGraph Workflow                          |
|                                                                   |
|   [START] -> (planner) -> (searcher) -> (reviewer)                |
|                                            |                      |
|                                  [isSufficient / max loops]       |
|                                    /                     \        |
|                               (Yes)                      (No)     |
|                                 v                          v      |
|                            (reporter)               (search again)|
|                                 |                                 |
|                              [END]                                |
+------------------+------------------------------+-----------------+
                   |                              |
                   v                              v
+------------------+---------------+ +------------+-----------------+
|          Model Provider Layer    | |          Tool Layer          |
|  - Ollama (Local qwen3:8b)       | |  - Web Search (Tavily/Engine)|
|  - Google Gemini (Gen AI SDK)    | |  - Extensible Tool Registry  |
|  - OpenAI                        | |  - Future RAG Retriever      |
+----------------------------------+ +------------------------------+
```

## Core Modules

### 1. `config/`
- **`env.ts`**: Validates environment variables using Zod schemas at boot time.
- **`model.ts`**: Provider factory isolating model implementation details from business logic. Supports runtime switching between Ollama, Google Gemini, and OpenAI.

### 2. `core/`
- **`types.ts`**: Domain entities including `EvidenceSource`, `ResearchPlan`, `ReviewAssessment`, and `ResearchReport`.
- **`errors.ts`**: Standardized domain exception hierarchy (`ModelProviderError`, `ToolExecutionError`, `ValidationError`).

### 3. `tools/`
- **`web-search.ts`**: Encapsulates external search capabilities. Communicates with Tavily Search API when configured, with fallback search capabilities for offline testing.
- **`registry.ts`**: Registry for dynamically configuring and discovering agent tools.

### 4. `graph/`
- **`state.ts`**: Defines the shared state channel annotations for LangGraph, including deduplicating evidence reducers and loop iteration bounds.
- **`nodes/`**: Single-responsibility nodes for planning (`planner`), searching (`searcher`), reviewing (`reviewer`), and report writing (`reporter`).
- **`edges.ts`**: Pure conditional routing functions enforcing convergence and iteration caps.
- **`research-graph.ts`**: Compiles the cyclical state machine.

### 5. `services/`
- **`research.service.ts`**: High-level application service that exposes a clean programmatic API with progress hooks.

### 6. `api/`
- **`server.ts` & `routes.ts`**: Express-based HTTP microservice exposing health checks, model metadata, and research execution endpoints.

## Future Scaling Path
- **Durable Checkpointing**: Mount PostgreSQL (`@langchain/langgraph-checkpoint-postgres`) to persist state across server restarts.
- **Background Job Queue**: Integrate BullMQ or Celery for long-running batch research jobs.
- **Streaming & Observability**: Stream node-level thoughts using Server-Sent Events (SSE) and emit OpenTelemetry traces.
