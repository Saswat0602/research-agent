import { prisma } from "../db/client.js";
import { EvidenceSource } from "../core/types.js";

export interface KnowledgeDocumentInput {
  title: string;
  content: string;
  sourceUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
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

    // Query private knowledge documents using case-insensitive keyword matching
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
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return documents.map((doc) => ({
      title: `[Internal Knowledge] ${doc.title}`,
      url: doc.sourceUrl || `internal-kb://${doc.id}`,
      content: doc.content.slice(0, 1500),
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
