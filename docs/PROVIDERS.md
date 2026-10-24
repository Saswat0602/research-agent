# Model Providers & Tool Configuration

The Research Agent is built to be provider-independent. You can switch between local inference and cloud AI models via environment configuration without modifying application code.

## Supported Providers

### 1. Ollama (Local Inference)

Run open-source models completely locally with zero API costs and full privacy.

#### Prerequisites
1. Ensure Ollama is installed and running:
   ```bash
   ollama --version
   ```
2. Pull your chosen model (e.g. `qwen3:8b`):
   ```bash
   ollama pull qwen3:8b
   ```
3. Set environment variables in `.env`:
   ```env
   MODEL_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen3:8b
   ```

---

### 2. Google Gemini (Cloud Inference)

Leverage Google's high-speed, state-of-the-art models (`gemini-2.5-flash`, `gemini-2.5-pro`) and the official Google Gen AI SDK integration.

#### Prerequisites
1. Obtain an API key from Google AI Studio ([https://aistudio.google.com/](https://aistudio.google.com/)).
2. Set environment variables in `.env`:
   ```env
   MODEL_PROVIDER=google
   GOOGLE_API_KEY=your_gemini_api_key_here
   GOOGLE_MODEL=gemini-2.5-flash
   ```

---

### 3. OpenAI (Optional)

#### Prerequisites
1. Obtain an API key from OpenAI Platform ([https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)).
2. Set environment variables in `.env`:
   ```env
   MODEL_PROVIDER=openai
   OPENAI_API_KEY=your_openai_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```

---

## Web Search Tooling

### Tavily API (Recommended for live production search)
1. Sign up for a free search key at [Tavily](https://app.tavily.com/).
2. Add your key to `.env`:
   ```env
   TAVILY_API_KEY=tvly-your_key_here
   ```

### Fallback Engine (Zero-Config Development)
If `TAVILY_API_KEY` is not provided, the search tool automatically uses an integrated structured research engine. This ensures the workflow functions immediately out of the box during development and testing.
