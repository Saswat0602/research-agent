import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { getAppConfig } from "./env.js";
import {
  circuitBreakerRegistry,
  withRetry,
  withTimeout,
  CircuitBreakerOpenError,
} from "../core/resilience.js";

export interface ModelOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  streaming?: boolean;
}

export function createChatModel(options: ModelOptions = {}): BaseChatModel {
  const config = getAppConfig();
  const provider = (options.provider || config.MODEL_PROVIDER).toLowerCase();
  const temperature = options.temperature ?? 0;

  switch (provider) {
    case "ollama":
      return new ChatOllama({
        baseUrl: config.OLLAMA_BASE_URL,
        model: options.model || config.OLLAMA_MODEL,
        temperature,
      });

    case "google-adk":
    case "gemini":
    case "google": {
      const apiKey = config.GEMINI_API_KEY || config.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required when using gemini/google/adk provider");
      }
      const modelName = options.model || config.GEMINI_MODEL || config.GOOGLE_MODEL || "gemini-3.5-flash-lite";
      return new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey,
        temperature,
      });
    }

    case "openai": {
      if (!config.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when using openai provider");
      }
      return new ChatOpenAI({
        model: options.model || config.OPENAI_MODEL,
        apiKey: config.OPENAI_API_KEY,
        temperature,
      });
    }

    case "openrouter": {
      const apiKey = config.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is required when using openrouter provider");
      }
      return new ChatOpenAI({
        model: options.model || config.OPENROUTER_MODEL,
        apiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
        temperature,
      });
    }

    case "claude":
    case "anthropic": {
      const apiKey = config.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is required when using anthropic/claude provider");
      }
      return new ChatAnthropic({
        model: options.model || config.ANTHROPIC_MODEL,
        apiKey,
        temperature,
      });
    }

    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}

export interface ResilientInvocationOptions {
  providerName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fallbackModel?: BaseChatModel;
}

/**
 * Resilient invocation wrapper implementing Circuit Breaker, Retries with jitter,
 * Timeout bounds, and automated Provider Fallback (Chain of Responsibility).
 */
export async function invokeModelWithResilience(
  model: BaseChatModel,
  messages: BaseMessage[],
  options: ResilientInvocationOptions = {}
): Promise<BaseMessage> {
  const provider = options.providerName ?? "primary-llm";
  const breaker = circuitBreakerRegistry.getOrCreate(provider, {
    failureThreshold: 3,
    resetTimeoutMs: 15000,
  });
  const timeoutMs = options.timeoutMs ?? 45000;
  const maxRetries = options.maxRetries ?? 2;

  try {
    return await breaker.execute(async () => {
      return await withRetry(
        async () => {
          return await withTimeout(
            model.invoke(messages) as Promise<BaseMessage>,
            timeoutMs,
            `LLM [${provider}] Invoke`
          );
        },
        {
          maxRetries,
          initialDelayMs: 600,
          retryOn: (err: unknown) => {
            const msg = err instanceof Error ? err.message.toLowerCase() : "";
            // Do not retry if explicitly bad prompt/validation error
            if (msg.includes("invalid argument") || msg.includes("validation")) return false;
            return true;
          },
        }
      );
    });
  } catch (primaryError) {
    // If fallback model is provided, gracefully engage fallback provider
    if (options.fallbackModel) {
      console.warn(
        `[Resilience] Primary LLM (${provider}) failed: ${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }. Initiating fallback provider...`
      );
      const fallbackBreaker = circuitBreakerRegistry.getOrCreate("fallback-llm", {
        failureThreshold: 2,
        resetTimeoutMs: 15000,
      });
      return await fallbackBreaker.execute(async () => {
        return await withTimeout(
          options.fallbackModel!.invoke(messages) as Promise<BaseMessage>,
          timeoutMs,
          "Fallback LLM Invoke"
        );
      });
    }

    throw primaryError;
  }
}
