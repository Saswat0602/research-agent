import { ResearchReport, ReportFinding, EvidenceSource } from "./types.js";

export interface CitationVerificationResult {
  verifiedReport: ResearchReport;
  verificationScore: number;
  totalClaimsCount: number;
  verifiedClaimsCount: number;
  rejectedClaims: Array<{
    claim: string;
    sourceUrl: string;
    reason: "UNKNOWN_SOURCE_URL" | "SNIPPET_NOT_FOUND_IN_EVIDENCE";
  }>;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasSnippetSupport(snippet: string, evidenceContent: string): boolean {
  const normSnippet = normalize(snippet);
  const normContent = normalize(evidenceContent);

  // Exact or near substring match
  if (normContent.includes(normSnippet)) {
    return true;
  }

  // Token-level overlap for paraphrased / truncated snippets
  const snippetTokens = normSnippet.split(" ").filter((t) => t.length > 3);
  if (snippetTokens.length === 0) return true;

  let matchingTokens = 0;
  for (const token of snippetTokens) {
    if (normContent.includes(token)) {
      matchingTokens++;
    }
  }

  const overlapRatio = matchingTokens / snippetTokens.length;
  return overlapRatio >= 0.6; // At least 60% semantic token match
}

export function verifyReportCitations(
  rawReport: ResearchReport,
  collectedEvidence: EvidenceSource[]
): CitationVerificationResult {
  const evidenceMap = new Map<string, EvidenceSource>();
  for (const item of collectedEvidence) {
    evidenceMap.set(item.url.trim().toLowerCase(), item);
  }

  const verifiedFindings: ReportFinding[] = [];
  const rejectedClaims: CitationVerificationResult["rejectedClaims"] = [];

  for (const finding of rawReport.keyFindings) {
    const canonicalUrl = finding.sourceUrl.trim().toLowerCase();
    const matchedEvidence = evidenceMap.get(canonicalUrl);

    if (!matchedEvidence) {
      rejectedClaims.push({
        claim: finding.claim,
        sourceUrl: finding.sourceUrl,
        reason: "UNKNOWN_SOURCE_URL",
      });
      continue;
    }

    if (!hasSnippetSupport(finding.evidenceSnippet, matchedEvidence.content)) {
      rejectedClaims.push({
        claim: finding.claim,
        sourceUrl: finding.sourceUrl,
        reason: "SNIPPET_NOT_FOUND_IN_EVIDENCE",
      });
      continue;
    }

    verifiedFindings.push(finding);
  }

  const totalClaims = rawReport.keyFindings.length;
  const verifiedCount = verifiedFindings.length;
  const verificationScore = totalClaims > 0 ? Number((verifiedCount / totalClaims).toFixed(2)) : 1.0;

  // Filter sources list to only verified URLs
  const verifiedUrls = new Set(verifiedFindings.map((f) => f.sourceUrl.trim().toLowerCase()));
  const verifiedSources = rawReport.sources.filter((s) =>
    verifiedUrls.has(s.url.trim().toLowerCase())
  );

  const verifiedReport: ResearchReport = {
    ...rawReport,
    keyFindings: verifiedFindings,
    sources: verifiedSources.length > 0 ? verifiedSources : rawReport.sources,
  };

  return {
    verifiedReport,
    verificationScore,
    totalClaimsCount: totalClaims,
    verifiedClaimsCount: verifiedCount,
    rejectedClaims,
  };
}
