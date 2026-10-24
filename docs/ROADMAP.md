# Engineering Roadmap

This project is structured for incremental extension from a single-agent prototype into an enterprise research system.

## Milestone 1: Tool-Using Agent & LangGraph Core (Current)
- [x] Provider-agnostic model factory (Ollama, Google Gemini, OpenAI)
- [x] Zod-enforced environment configuration
- [x] LangGraph cyclical state machine (`planner -> searcher -> reviewer -> reporter`)
- [x] Deduplicating evidence reducer & bounded loop iterations
- [x] Web search tool with Tavily and local development fallback
- [x] Express microservice REST API (`/health`, `/models`, `/research`)
- [x] CLI entrypoint with formatted output

## Milestone 2: RAG & Vector Retrieval
- [ ] Ingest local documents (PDF, Markdown, Web dumps)
- [ ] Integrate local vector embedding model (`nomic-embed-text` via Ollama)
- [ ] Implement hybrid retrieval: local knowledge base + live web search
- [ ] Add citation tracking across local chunks and web evidence

## Milestone 3: Durable State & Human Approval
- [ ] Add PostgreSQL checkpointer (`@langchain/langgraph-checkpoint-postgres`)
- [ ] Add Human-in-the-Loop review interrupt before executing external tools
- [ ] Resume paused workflows via thread IDs
- [ ] Implement exponential backoff and retry policies for external network calls

## Milestone 4: Distributed Microservices & Observability
- [ ] Queue-based async job execution with Redis / BullMQ
- [ ] Server-Sent Events (SSE) streaming for real-time thought visualization
- [ ] OpenTelemetry instrumentation for LLM token usage, latency, and tool failure tracking
- [ ] Docker & Docker Compose setup for local orchestration
