import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { getAppConfig } from "./env.js";

export interface ModelOptions {
  temperature?: number;
  streaming?: boolean;
}

export function createChatModel(options: ModelOptions = {}): BaseChatModel {
  const config = getAppConfig();
  const temperature = options.temperature ?? 0;

  switch (config.MODEL_PROVIDER) {
    case "ollama":
      return new ChatOllama({
        baseUrl: config.OLLAMA_BASE_URL,
        model: config.OLLAMA_MODEL,
        temperature,
      });

    case "gemini":
    case "google": {
      const apiKey = config.GEMINI_API_KEY || config.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required when using gemini/google provider");
      }
      const modelName = config.GEMINI_MODEL || config.GOOGLE_MODEL || "gemini-3.5-flash";
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
        model: config.OPENAI_MODEL,
        apiKey: config.OPENAI_API_KEY,
        temperature,
      });
    }

    default:
      throw new Error(`Unsupported model provider: ${config.MODEL_PROVIDER}`);
  }
}
