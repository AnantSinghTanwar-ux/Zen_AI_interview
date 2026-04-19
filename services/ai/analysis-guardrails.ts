type BoundedScoreInput = number | null | undefined;

export interface TranscriptEvidenceSnapshot {
  hasTechnicalDepth: boolean;
  hasProblemSolvingDepth: boolean;
  hasCodeDepth: boolean;
  hasSystemDesignDepth: boolean;
  hasResumeDeflection: boolean;
  candidateTurns: number;
  avgCandidateWords: number;
}

interface HarshFeedbackScoreShape {
  overallScore?: BoundedScoreInput;
  communicationScore?: BoundedScoreInput;
  technicalScore?: BoundedScoreInput;
  problemSolvingScore?: BoundedScoreInput;
  confidenceScore?: BoundedScoreInput;
}

interface RecruiterScoreShape {
  overallScore?: BoundedScoreInput;
  communicationScore?: BoundedScoreInput;
  technicalScore?: BoundedScoreInput;
  problemSolvingScore?: BoundedScoreInput;
  recommendation?: string;
}

interface StructuredEvaluationShape {
  overallRating?: BoundedScoreInput;
  confidenceLevel?: BoundedScoreInput;
  recommendation?: string;
  aspects?: {
    technicalKnowledge?: { score?: BoundedScoreInput };
    problemSolving?: { score?: BoundedScoreInput };
    communication?: { score?: BoundedScoreInput };
    codeQuality?: { score?: BoundedScoreInput };
    systemDesign?: { score?: BoundedScoreInput };
    criticalThinking?: { score?: BoundedScoreInput };
    behavioralFit?: { score?: BoundedScoreInput };
  };
}

function clampScore(value: BoundedScoreInput, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function clampScoreOptional(
  value: BoundedScoreInput,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function countPatternHits(text: string, patterns: string[]): number {
  return patterns.reduce((count, pattern) => {
    const regex = new RegExp(`\\b${pattern}\\b`, "g");
    const matches = text.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function normalizeTranscript(transcript: string): string {
  return String(transcript || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getCandidateSegments(transcript: string): string[] {
  const lines = String(transcript || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidateLines = lines
    .filter((line) => /^candidate\s*:/i.test(line))
    .map((line) => line.replace(/^candidate\s*:/i, "").trim())
    .filter(Boolean);

  if (candidateLines.length > 0) {
    return candidateLines;
  }

  // Fallback when role labels are absent.
  return lines.filter((line) => line.length >= 8);
}

export function analyzeTranscriptEvidence(transcript: string): TranscriptEvidenceSnapshot {
  const normalized = normalizeTranscript(transcript);
  const candidateSegments = getCandidateSegments(transcript);
  const candidateText = candidateSegments.join(" ").toLowerCase();

  const technicalPatterns = [
    "algorithm",
    "data structure",
    "time complexity",
    "space complexity",
    "big o",
    "optimization",
    "database",
    "index",
    "query",
    "api",
    "distributed",
    "concurrency",
    "memory",
    "latency",
    "throughput",
    "cache",
    "transaction",
    "deadlock",
  ];

  const problemPatterns = [
    "approach",
    "trade off",
    "tradeoff",
    "edge case",
    "test case",
    "complexity",
    "first i would",
    "then i would",
    "because",
    "constraint",
  ];

  const codePatterns = [
    "function",
    "class",
    "loop",
    "recursion",
    "pointer",
    "array",
    "hashmap",
    "binary",
    "dfs",
    "bfs",
    "stack",
    "queue",
  ];

  const systemPatterns = [
    "scalability",
    "load balancer",
    "microservice",
    "partition",
    "replication",
    "eventual consistency",
    "message queue",
    "fault tolerance",
    "high availability",
    "throughput",
    "bottleneck",
  ];

  const technicalHits = countPatternHits(candidateText, technicalPatterns);
  const problemHits = countPatternHits(candidateText, problemPatterns);
  const codeHits = countPatternHits(candidateText, codePatterns);
  const systemHits = countPatternHits(candidateText, systemPatterns);

  const totalCandidateWords = candidateSegments.reduce((sum, segment) => {
    const words = segment.split(/\s+/).filter(Boolean).length;
    return sum + words;
  }, 0);

  const candidateTurns = candidateSegments.length;
  const avgCandidateWords =
    candidateTurns > 0 ? totalCandidateWords / candidateTurns : totalCandidateWords;

  const hasResumeDeflection =
    /read (my )?resume|check (my )?resume|look at (my )?resume|as in my resume|my cv|my background/i.test(
      normalized
    );

  const hasTechnicalDepth = technicalHits >= 3 && totalCandidateWords >= 45;
  const hasProblemSolvingDepth = problemHits >= 2 && totalCandidateWords >= 45;
  const hasCodeDepth = codeHits >= 2;
  const hasSystemDesignDepth = systemHits >= 2;

  return {
    hasTechnicalDepth,
    hasProblemSolvingDepth,
    hasCodeDepth,
    hasSystemDesignDepth,
    hasResumeDeflection,
    candidateTurns,
    avgCandidateWords,
  };
}

export function applyHarshFeedbackGuardrails<T extends HarshFeedbackScoreShape>(
  input: T,
  transcript: string
): T {
  const evidence = analyzeTranscriptEvidence(transcript);

  const technicalScore = clampScoreOptional(input.technicalScore, 0, 100, 0);
  const problemSolvingScore = clampScoreOptional(input.problemSolvingScore, 0, 100, 0);
  const communicationScore = clampScoreOptional(input.communicationScore, 0, 100, 0);
  const confidenceScore = clampScoreOptional(input.confidenceScore, 0, 100, communicationScore);
  const overallScore = clampScoreOptional(input.overallScore, 0, 100, 0);

  let adjustedTechnical = technicalScore;
  let adjustedProblem = problemSolvingScore;
  let adjustedCommunication = communicationScore;
  let adjustedConfidence = confidenceScore;
  let adjustedOverall = overallScore;

  if (!evidence.hasTechnicalDepth) {
    adjustedTechnical = Math.min(adjustedTechnical, 35);
  }

  if (!evidence.hasProblemSolvingDepth) {
    adjustedProblem = Math.min(adjustedProblem, 35);
  }

  if (evidence.avgCandidateWords < 12 || evidence.candidateTurns < 3) {
    adjustedCommunication = Math.min(adjustedCommunication, 55);
    adjustedConfidence = Math.min(adjustedConfidence, 55);
  }

  if (evidence.hasResumeDeflection && !evidence.hasTechnicalDepth) {
    adjustedOverall = Math.min(adjustedOverall, 55);
    adjustedConfidence = Math.min(adjustedConfidence, 50);
  }

  const componentAverage = Math.round(
    (adjustedTechnical + adjustedProblem + adjustedCommunication + adjustedConfidence) / 4
  );

  adjustedOverall = Math.min(adjustedOverall, componentAverage);
  adjustedOverall = clampScore(adjustedOverall, 0, 100);

  return {
    ...input,
    overallScore: adjustedOverall,
    communicationScore: clampScore(adjustedCommunication, 0, 100),
    technicalScore: clampScore(adjustedTechnical, 0, 100),
    problemSolvingScore: clampScore(adjustedProblem, 0, 100),
    confidenceScore: clampScore(adjustedConfidence, 0, 100),
  };
}

export function applyRecruiterScoreGuardrails<T extends RecruiterScoreShape>(
  input: T,
  transcript: string
): T {
  const evidence = analyzeTranscriptEvidence(transcript);

  let technicalScore = clampScoreOptional(input.technicalScore, 0, 100, 0);
  let problemSolvingScore = clampScoreOptional(input.problemSolvingScore, 0, 100, 0);
  let communicationScore = clampScoreOptional(input.communicationScore, 0, 100, 0);
  let overallScore = clampScoreOptional(input.overallScore, 0, 100, 0);

  if (!evidence.hasTechnicalDepth) {
    technicalScore = Math.min(technicalScore, 35);
  }

  if (!evidence.hasProblemSolvingDepth) {
    problemSolvingScore = Math.min(problemSolvingScore, 35);
  }

  if (evidence.avgCandidateWords < 12 || evidence.candidateTurns < 3) {
    communicationScore = Math.min(communicationScore, 55);
  }

  if (evidence.hasResumeDeflection && !evidence.hasTechnicalDepth) {
    overallScore = Math.min(overallScore, 55);
  }

  const componentAverage = Math.round(
    (technicalScore + problemSolvingScore + communicationScore) / 3
  );
  overallScore = Math.min(overallScore, componentAverage);

  const normalizedOverall = clampScore(overallScore, 0, 100);

  let recommendation = String(input.recommendation || "").toLowerCase().trim();
  if (normalizedOverall >= 85) recommendation = "strong_hire";
  else if (normalizedOverall >= 70) recommendation = "hire";
  else if (normalizedOverall >= 45) recommendation = "maybe";
  else recommendation = "no_hire";

  return {
    ...input,
    overallScore: normalizedOverall,
    technicalScore: clampScore(technicalScore, 0, 100),
    communicationScore: clampScore(communicationScore, 0, 100),
    problemSolvingScore: clampScore(problemSolvingScore, 0, 100),
    recommendation,
  };
}

function recommendationFromOverall(overall: number): string {
  if (overall >= 8.8) return "Strong Hire";
  if (overall >= 7.2) return "Hire";
  if (overall >= 4.5) return "No Hire";
  return "Strong No Hire";
}

export function applyStructuredEvaluationGuardrails<T extends StructuredEvaluationShape>(
  input: T,
  transcript: string
): T {
  const evidence = analyzeTranscriptEvidence(transcript);

  const aspects = input.aspects || {};

  const technicalKnowledge = clampScoreOptional(aspects.technicalKnowledge?.score, 1, 10, 5);
  const problemSolving = clampScoreOptional(aspects.problemSolving?.score, 1, 10, 5);
  const communication = clampScoreOptional(aspects.communication?.score, 1, 10, 5);
  const codeQuality = clampScoreOptional(aspects.codeQuality?.score, 1, 10, 5);
  const systemDesign = clampScoreOptional(aspects.systemDesign?.score, 1, 10, 5);
  const criticalThinking = clampScoreOptional(aspects.criticalThinking?.score, 1, 10, 5);
  const behavioralFit = clampScoreOptional(aspects.behavioralFit?.score, 1, 10, 5);

  let adjustedTechnical = technicalKnowledge;
  let adjustedProblem = problemSolving;
  let adjustedCommunication = communication;
  let adjustedCodeQuality = codeQuality;
  let adjustedSystemDesign = systemDesign;
  let adjustedConfidence = clampScoreOptional(input.confidenceLevel, 1, 10, 5);

  if (!evidence.hasTechnicalDepth) {
    adjustedTechnical = Math.min(adjustedTechnical, 4);
  }

  if (!evidence.hasProblemSolvingDepth) {
    adjustedProblem = Math.min(adjustedProblem, 4);
  }

  if (!evidence.hasCodeDepth) {
    adjustedCodeQuality = Math.min(adjustedCodeQuality, 4);
  }

  if (!evidence.hasSystemDesignDepth) {
    adjustedSystemDesign = Math.min(adjustedSystemDesign, 4);
  }

  if (evidence.avgCandidateWords < 12 || evidence.candidateTurns < 3) {
    adjustedCommunication = Math.min(adjustedCommunication, 5);
    adjustedConfidence = Math.min(adjustedConfidence, 5);
  }

  if (evidence.hasResumeDeflection && !evidence.hasTechnicalDepth) {
    adjustedConfidence = Math.min(adjustedConfidence, 4);
  }

  const averageScore =
    (adjustedTechnical +
      adjustedProblem +
      adjustedCommunication +
      criticalThinking +
      adjustedCodeQuality +
      adjustedSystemDesign +
      behavioralFit) /
    7;

  const adjustedOverall = Math.min(
    clampScoreOptional(input.overallRating, 1, 10, 5),
    Math.round(averageScore * 10) / 10
  );

  return {
    ...input,
    overallRating: clampScore(adjustedOverall, 1, 10),
    confidenceLevel: clampScore(adjustedConfidence, 1, 10),
    recommendation: recommendationFromOverall(adjustedOverall),
    aspects: {
      ...aspects,
      technicalKnowledge: {
        ...(aspects.technicalKnowledge || {}),
        score: clampScore(adjustedTechnical, 1, 10),
      },
      problemSolving: {
        ...(aspects.problemSolving || {}),
        score: clampScore(adjustedProblem, 1, 10),
      },
      communication: {
        ...(aspects.communication || {}),
        score: clampScore(adjustedCommunication, 1, 10),
      },
      codeQuality: {
        ...(aspects.codeQuality || {}),
        score: clampScore(adjustedCodeQuality, 1, 10),
      },
      systemDesign: {
        ...(aspects.systemDesign || {}),
        score: clampScore(adjustedSystemDesign, 1, 10),
      },
      criticalThinking: {
        ...(aspects.criticalThinking || {}),
        score: clampScore(criticalThinking, 1, 10),
      },
      behavioralFit: {
        ...(aspects.behavioralFit || {}),
        score: clampScore(behavioralFit, 1, 10),
      },
    },
  };
}
