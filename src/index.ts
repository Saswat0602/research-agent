import "dotenv/config";
import { researchService } from "./services/research.service.js";
import { getAppConfig } from "./config/env.js";

async function main() {
  const config = getAppConfig();
  const inputTopic = process.argv.slice(2).join(" ").trim() ||
    "Research the latest developments in AI agents and Google ADK JS";

  console.log("=================================================");
  console.log("        RESEARCH AGENT ORCHESTRATOR             ");
  console.log("=================================================");
  console.log(`Model Provider : ${config.MODEL_PROVIDER}`);
  console.log(
    `Model          : ${
      config.MODEL_PROVIDER === "ollama"
        ? config.OLLAMA_MODEL
        : config.MODEL_PROVIDER === "gemini" || config.MODEL_PROVIDER === "google"
        ? (config.GEMINI_MODEL || config.GOOGLE_MODEL)
        : config.OPENAI_MODEL
    }`
  );
  console.log(`Topic          : "${inputTopic}"`);
  console.log(`Max Iterations : ${config.MAX_RESEARCH_LOOPS}`);
  console.log("-------------------------------------------------\n");

  const startTime = Date.now();

  try {
    const { report, sessionId } = await researchService.conductResearch(inputTopic, {
      onProgress: (step, details) => {
        console.log(`[STATUS] ${step}`, details ? JSON.stringify(details) : "");
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n=================================================");
    console.log("               FINAL RESEARCH REPORT             ");
    console.log("=================================================");
    console.log(`\nSession ID : ${sessionId} (Persisted in PostgreSQL)`);
    console.log(`Topic      : ${report.topic}`);
    console.log(`Completed in ${elapsed}s (Loops used: ${report.loopsUsed})\n`);

    console.log("--- SUMMARY ---");
    console.log(report.summary);

    console.log("\n--- KEY FINDINGS & SOURCED EVIDENCE ---");
    report.keyFindings.forEach((finding, index) => {
      console.log(`\n[${index + 1}] Claim: ${finding.claim}`);
      console.log(`    Source: ${finding.sourceUrl}`);
      console.log(`    Snippet: "${finding.evidenceSnippet}"`);
    });

    console.log("\n--- REFERENCED SOURCES ---");
    report.sources.forEach((source, index) => {
      console.log(`[${index + 1}] ${source.title} (${source.url})`);
    });

    console.log("\n--- CONCLUSION ---");
    console.log(report.conclusion);
    console.log("=================================================\n");
  } catch (error) {
    console.error("\nResearch agent execution failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
