import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  MODEL_PROVIDER: z.enum(["ollama", "google", "gemini", "openai"]).default("google"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen3:8b"),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  TAVILY_API_KEY: z.string().optional(),
  MAX_RESEARCH_LOOPS: z.coerce.number().int().min(1).max(10).default(3),
  PORT: z.coerce.number().int().default(3000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function getAppConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Configuration validation error:", result.error.format());
    throw new Error("Invalid application configuration");
  }
  return result.data;
}
