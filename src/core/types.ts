export interface EvidenceSource {
  title: string;
  url: string;
  content: string;
  query?: string;
}

export interface ResearchPlan {
  topic: string;
  initialQueries: string[];
  focusAreas: string[];
  needsExternalSearch: boolean;
  rationale: string;
}

export interface ReviewAssessment {
  isSufficient: boolean;
  missingInfo: string[];
  nextQueries: string[];
  confidenceScore: number;
  evaluationNotes: string;
}

export interface ReportFinding {
  claim: string;
  sourceUrl: string;
  evidenceSnippet: string;
}

export interface ResearchReport {
  topic: string;
  summary: string;
  keyFindings: ReportFinding[];
  sources: Array<{ title: string; url: string }>;
  conclusion: string;
  generatedAt: string;
  loopsUsed: number;
}
