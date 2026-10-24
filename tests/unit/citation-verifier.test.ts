import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyReportCitations } from "../../src/core/citation-verifier.js";
import { ResearchReport, EvidenceSource } from "../../src/core/types.js";

describe("Core: Deterministic Citation Verifier", () => {
  const mockEvidence: EvidenceSource[] = [
    {
      title: "Google ADK JS Guide",
      url: "https://github.com/google/adk-js",
      content: "Google ADK JS is an open-source framework for building production-grade AI agents.",
    },
    {
      title: "LangGraph Overview",
      url: "https://docs.langchain.com/oss/javascript/langgraph",
      content: "LangGraph provides cyclically structured multi-agent workflows with durable checkpoints.",
    },
  ];

  test("accepts fully verified claims with exact supporting snippets", () => {
    const rawReport: ResearchReport = {
      topic: "AI Agents",
      summary: "Overview of modern agent frameworks.",
      keyFindings: [
        {
          claim: "Google ADK JS is open source for agents",
          sourceUrl: "https://github.com/google/adk-js",
          evidenceSnippet: "Google ADK JS is an open-source framework for building production-grade AI agents.",
        },
        {
          claim: "LangGraph supports checkpoints",
          sourceUrl: "https://docs.langchain.com/oss/javascript/langgraph",
          evidenceSnippet: "LangGraph provides cyclically structured multi-agent workflows with durable checkpoints.",
        },
      ],
      sources: [
        { title: "Google ADK JS Guide", url: "https://github.com/google/adk-js" },
        { title: "LangGraph Overview", url: "https://docs.langchain.com/oss/javascript/langgraph" },
      ],
      conclusion: "Both frameworks are viable.",
      generatedAt: new Date().toISOString(),
      loopsUsed: 1,
    };

    const result = verifyReportCitations(rawReport, mockEvidence);

    assert.equal(result.verificationScore, 1.0);
    assert.equal(result.verifiedClaimsCount, 2);
    assert.equal(result.rejectedClaims.length, 0);
    assert.equal(result.verifiedReport.keyFindings.length, 2);
  });

  test("rejects claims that cite an uncollected or fabricated URL", () => {
    const rawReport: ResearchReport = {
      topic: "AI Agents",
      summary: "Overview.",
      keyFindings: [
        {
          claim: "Google ADK JS is open source",
          sourceUrl: "https://github.com/google/adk-js",
          evidenceSnippet: "Google ADK JS is an open-source framework",
        },
        {
          claim: "Hallucinated claim with fake URL",
          sourceUrl: "https://completely-fabricated-source.com/news",
          evidenceSnippet: "Fake text that was never retrieved.",
        },
      ],
      sources: [
        { title: "Google ADK JS Guide", url: "https://github.com/google/adk-js" },
        { title: "Fake Source", url: "https://completely-fabricated-source.com/news" },
      ],
      conclusion: "Done.",
      generatedAt: new Date().toISOString(),
      loopsUsed: 1,
    };

    const result = verifyReportCitations(rawReport, mockEvidence);

    assert.equal(result.verificationScore, 0.5);
    assert.equal(result.verifiedClaimsCount, 1);
    assert.equal(result.rejectedClaims.length, 1);
    assert.equal(result.rejectedClaims[0].reason, "UNKNOWN_SOURCE_URL");
    assert.equal(result.rejectedClaims[0].sourceUrl, "https://completely-fabricated-source.com/news");

    // Verified report must exclude the fabricated finding
    assert.equal(result.verifiedReport.keyFindings.length, 1);
    assert.equal(result.verifiedReport.keyFindings[0].sourceUrl, "https://github.com/google/adk-js");
  });

  test("rejects claims where snippet is not grounded in the source text", () => {
    const rawReport: ResearchReport = {
      topic: "AI Agents",
      summary: "Overview.",
      keyFindings: [
        {
          claim: "Claim citing real URL but fabricated text",
          sourceUrl: "https://github.com/google/adk-js",
          evidenceSnippet: "This sentence does not exist anywhere in the ADK repository documentation at all.",
        },
      ],
      sources: [{ title: "Google ADK JS Guide", url: "https://github.com/google/adk-js" }],
      conclusion: "Done.",
      generatedAt: new Date().toISOString(),
      loopsUsed: 1,
    };

    const result = verifyReportCitations(rawReport, mockEvidence);

    assert.equal(result.verificationScore, 0);
    assert.equal(result.verifiedClaimsCount, 0);
    assert.equal(result.rejectedClaims.length, 1);
    assert.equal(result.rejectedClaims[0].reason, "SNIPPET_NOT_FOUND_IN_EVIDENCE");
    assert.equal(result.verifiedReport.keyFindings.length, 0);
  });
});
