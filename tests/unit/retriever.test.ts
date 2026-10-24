import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, scoreRelevance } from "../../src/retrieval/retriever.js";

describe("Retriever: Document Chunking", () => {
  it("returns single chunk when content is smaller than chunkSize", () => {
    const text = "Short article about distributed consensus.";
    const chunks = chunkText(text, 500, 100);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].chunkIndex, 0);
    assert.equal(chunks[0].text, text);
  });

  it("splits large text into overlapping chunks", () => {
    const sentence = "The quick brown fox jumps over the lazy dog. ";
    const longText = sentence.repeat(30); // ~1350 characters
    const chunkSize = 400;
    const overlap = 100;

    const chunks = chunkText(longText, chunkSize, overlap);
    assert(chunks.length >= 4);

    for (let i = 0; i < chunks.length - 1; i++) {
      const current = chunks[i];
      const next = chunks[i + 1];
      assert.equal(current.chunkIndex, i);
      // Verify overlap: end of current chunk should overlap with start of next chunk
      const tailOfCurrent = current.text.slice(-50);
      assert(next.text.includes(tailOfCurrent));
    }
  });

  it("handles empty or whitespace strings gracefully", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   "), []);
  });
});

describe("Retriever: Relevance Scoring", () => {
  it("assigns higher score to title matches than body-only matches", () => {
    const titleMatch = scoreRelevance(
      "This document explains basic database architecture.",
      "PostgreSQL architecture",
      "Production PostgreSQL Architecture Guide"
    );

    const bodyOnlyMatch = scoreRelevance(
      "We briefly mention PostgreSQL architecture in passing here.",
      "PostgreSQL architecture",
      "General Software Overview"
    );

    assert(titleMatch > bodyOnlyMatch);
  });

  it("returns 0 score when no query keywords match", () => {
    const score = scoreRelevance(
      "Ancient roman aqueduct engineering techniques.",
      "Quantum Machine Learning",
      "History of Civil Infrastructure"
    );
    assert.equal(score, 0);
  });
});
