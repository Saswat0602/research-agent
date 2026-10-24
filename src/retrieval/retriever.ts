import { prisma } from "../db/client.js";
import { EvidenceSource } from "../core/types.js";

export interface KnowledgeDocumentInput {
  title: string;
  content: string;
  sourceUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
}

/**
 * Splits document content into overlapping chunks for RAG precision.
 */
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 150
): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];
  const clean = text.trim();
  if (clean.length <= chunkSize) {
    return [{ chunkIndex: 0, text: clean, charStart: 0, charEnd: clean.length }];
  }

  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push({
      chunkIndex: index++,
      text: clean.slice(start, end),
      charStart: start,
      charEnd: end,
    });
    if (end === clean.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Deterministic keyword relevance scoring for local RAG retrieval.
 */
export function scoreRelevance(text: string, query: string, title?: string): number {
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (queryTokens.length === 0) return 0;

  const lowerText = text.toLowerCase();
  const lowerTitle = (title || "").toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (lowerTitle.includes(token)) score += 3.0;
    let occurrences = 0;
    let pos = 0;
    while ((pos = lowerText.indexOf(token, pos)) !== -1) {
      occurrences++;
      pos += token.length;
    }
    score += Math.min(occurrences * 0.5, 5.0);
  }

  return score;
}

export class KnowledgeRetriever {
  async ingestDocument(input: KnowledgeDocumentInput) {
    return prisma.knowledgeDocument.create({
      data: {
        title: input.title,
        content: input.content,
        sourceUrl: input.sourceUrl,
        tags: input.tags ?? [],
        metadata: (input.metadata as object) ?? undefined,
      },
    });
  }

  async queryPrivateKnowledge(query: string, limit = 3): Promise<EvidenceSource[]> {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        OR: keywords.map((keyword) => ({
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { content: { contains: keyword, mode: "insensitive" } },
            { tags: { has: keyword } },
          ],
        })),
      },
      take: limit * 2,
    });

    const ranked = documents
      .map((doc) => {
        const score = scoreRelevance(doc.content, query, doc.title);
        // Best chunk
        const chunks = chunkText(doc.content, 1000, 150);
        let bestChunk = chunks[0]?.text || doc.content.slice(0, 1000);
        let maxChunkScore = -1;
        for (const c of chunks) {
          const cs = scoreRelevance(c.text, query);
          if (cs > maxChunkScore) {
            maxChunkScore = cs;
            bestChunk = c.text;
          }
        }
        return {
          doc,
          score,
          bestChunk,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return ranked.map(({ doc, bestChunk }) => ({
      title: `[Internal Knowledge] ${doc.title}`,
      url: doc.sourceUrl || `internal-kb://${doc.id}`,
      content: bestChunk,
      query,
    }));
  }

  async listDocuments(limit = 50) {
    return prisma.knowledgeDocument.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        tags: true,
        createdAt: true,
      },
    });
  }
}

export const knowledgeRetriever = new KnowledgeRetriever();
