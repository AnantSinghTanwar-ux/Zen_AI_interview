type BoundedScoreInput = number | null | undefined;

export interface TranscriptEvidenceSnapshot {
  hasTechnicalDepth: boolean;
  hasProblemSolvingDepth: boolean;
  hasCodeDepth: boolean;
  hasSystemDesignDepth: boolean;
  hasResumeDeflection: boolean;
  candidateTurns: number;
  avgCandidateWords: number;
  candidateWordCount: number;
  candidateRelevantWordCount: number;
  candidateRelevanceRatio: number;
  interviewerTurns: number;
  silenceLikeResponseTurns: number;
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
    .filter((line) => /^(candidate|user|human|applicant|interviewee)\s*:/i.test(line))
    .map((line) =>
      line
        .replace(/^(candidate|user|human|applicant|interviewee)\s*:/i, "")
        .trim()
    )
    .filter(Boolean);

  if (candidateLines.length > 0) {
    return candidateLines;
  }

  const labeledDialogueLines = lines
    .filter((line) => /^[a-z][a-z0-9 _-]{1,30}\s*:/i.test(line))
    .map((line) => {
      const [speaker, ...rest] = line.split(":");
      return {
        speaker: String(speaker || "").trim().toLowerCase(),
        text: rest.join(":").trim(),
      };
    })
    .filter((entry) => entry.text.length > 0);

  if (labeledDialogueLines.length > 0) {
    const likelyCandidate = labeledDialogueLines
      .filter(
        (entry) =>
          !/^(interviewer|assistant|bot|ai|system|question|q)$/i.test(entry.speaker)
      )
      .map((entry) => entry.text)
      .filter(Boolean);

    if (likelyCandidate.length > 0) {
      return likelyCandidate;
    }
  }

  // Fallback when role labels are absent.
  return lines.filter((line) => {
    if (line.length < 8) return false;
    if (/^\s*(interviewer|assistant|bot|ai)\s*:/i.test(line)) return false;
    if (/\?\s*$/.test(line) && line.length <= 220) return false;
    return true;
  });
}

export function analyzeTranscriptEvidence(transcript: string): TranscriptEvidenceSnapshot {
  const normalized = normalizeTranscript(transcript);
  const transcriptLines = String(transcript || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidateSegments = getCandidateSegments(transcript);
  const candidateText = candidateSegments.join(" ").toLowerCase();

  const interviewerTurns = transcriptLines.filter((line) =>
    /^(interviewer|assistant|bot|ai|system|question)\s*:/i.test(line)
  ).length;

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

  const relevantWordEstimate = technicalHits + problemHits + codeHits + systemHits;
  const candidateRelevanceRatio =
    totalCandidateWords > 0
      ? Math.min(1, Math.max(0, relevantWordEstimate / totalCandidateWords))
      : 0;

  const silenceLikeResponseTurns = candidateSegments.filter((segment) => {
    const text = segment.toLowerCase().trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 2) return true;
    if (/^(i don'?t know|no idea|skip|nothing|not sure|hmm|umm?)\b/i.test(text)) return true;
    return false;
  }).length;

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
    candidateWordCount: totalCandidateWords,
    candidateRelevantWordCount: relevantWordEstimate,
    candidateRelevanceRatio,
    interviewerTurns,
    silenceLikeResponseTurns,
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
    adjustedTechnical = Math.min(adjustedTechnical, 15);
  }

  if (!evidence.hasProblemSolvingDepth) {
    adjustedProblem = Math.min(adjustedProblem, 15);
  }

  if (evidence.avgCandidateWords < 18 || evidence.candidateTurns < 4) {
    adjustedCommunication = Math.min(adjustedCommunication, 25);
    adjustedConfidence = Math.min(adjustedConfidence, 25);
  }

  // Silence-like responses penalty
  if (
    evidence.candidateTurns >= 2 &&
    evidence.silenceLikeResponseTurns >= Math.ceil(evidence.candidateTurns * 0.6)
  ) {
    adjustedTechnical = Math.min(adjustedTechnical, 10);
    adjustedProblem = Math.min(adjustedProblem, 10);
    adjustedCommunication = Math.min(adjustedCommunication, 15);
    adjustedConfidence = Math.min(adjustedConfidence, 10);
  }

  if (evidence.hasResumeDeflection && !evidence.hasTechnicalDepth) {
    adjustedOverall = Math.min(adjustedOverall, 25);
    adjustedConfidence = Math.min(adjustedConfidence, 20);
  }

  if (!evidence.hasTechnicalDepth && !evidence.hasProblemSolvingDepth) {
    adjustedOverall = Math.min(adjustedOverall, 20);
  } else if (!evidence.hasTechnicalDepth || !evidence.hasProblemSolvingDepth) {
    adjustedOverall = Math.min(adjustedOverall, 35);
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

  // GUARD 1: Nearly empty transcripts (candidate said almost nothing)
  if (evidence.candidateWordCount < 15 || evidence.candidateTurns < 1) {
    technicalScore = Math.min(technicalScore, 5);
    problemSolvingScore = Math.min(problemSolvingScore, 5);
    communicationScore = Math.min(communicationScore, 5);
    overallScore = Math.min(overallScore, 5);
  }

  // GUARD 2: All responses are silence-like ("I don't know", one-word, etc.)
  if (
    evidence.candidateTurns >= 2 &&
    evidence.silenceLikeResponseTurns >= evidence.candidateTurns
  ) {
    technicalScore = Math.min(technicalScore, 5);
    problemSolvingScore = Math.min(problemSolvingScore, 5);
    communicationScore = Math.min(communicationScore, 8);
    overallScore = Math.min(overallScore, 5);
  }

  // GUARD 2b: Majority of responses are silence-like (>= 60% "I don't know"/empty)
  if (
    evidence.candidateTurns >= 3 &&
    evidence.silenceLikeResponseTurns >= Math.ceil(evidence.candidateTurns * 0.6)
  ) {
    technicalScore = Math.min(technicalScore, 10);
    problemSolvingScore = Math.min(problemSolvingScore, 10);
    communicationScore = Math.min(communicationScore, 15);
    overallScore = Math.min(overallScore, 10);
  }

  // GUARD 3: Interviewer asked many questions but candidate barely responded
  if (evidence.interviewerTurns >= 5 && evidence.candidateTurns <= 1) {
    overallScore = Math.min(overallScore, 5);
  }

  // GUARD 4: Candidate talked, but mostly non-technical/irrelevant content.
  if (evidence.candidateWordCount >= 25 && evidence.candidateRelevantWordCount < 3) {
    technicalScore = Math.min(technicalScore, 15);
    problemSolvingScore = Math.min(problemSolvingScore, 12);
    overallScore = Math.min(overallScore, 20);
  }

  if (evidence.candidateWordCount >= 40 && evidence.candidateRelevantWordCount < 5) {
    technicalScore = Math.min(technicalScore, 25);
    problemSolvingScore = Math.min(problemSolvingScore, 22);
    overallScore = Math.min(overallScore, 30);
  }

  // GUARD 5: Low answer coverage relative to interviewer prompts.
  const coverageRatio =
    evidence.interviewerTurns > 0
      ? evidence.candidateTurns / Math.max(1, evidence.interviewerTurns)
      : evidence.candidateTurns > 0
        ? 1
        : 0;

  if (evidence.interviewerTurns >= 4 && coverageRatio < 0.35) {
    technicalScore = Math.min(technicalScore, 20);
    problemSolvingScore = Math.min(problemSolvingScore, 18);
    communicationScore = Math.min(communicationScore, 30);
    overallScore = Math.min(overallScore, 25);
  }

  if (evidence.avgCandidateWords < 8 && evidence.candidateTurns >= 2) {
    communicationScore = Math.min(communicationScore, 25);
    overallScore = Math.min(overallScore, 22);
  }

  // GUARD 6: No technical depth detected by keyword analysis
  if (!evidence.hasTechnicalDepth) {
    technicalScore = Math.min(technicalScore, 30);
  }

  if (!evidence.hasProblemSolvingDepth) {
    problemSolvingScore = Math.min(problemSolvingScore, 28);
  }

  // GUARD 7: Blend model overall with deterministic weighted overall.
  // Heavily favor the deterministic weighted score for consistency.
  const weightedOverall =
    technicalScore * 0.4 + problemSolvingScore * 0.3 + communicationScore * 0.3;
  const blendedOverall = weightedOverall * 0.85 + overallScore * 0.15;
  overallScore = Math.min(blendedOverall, weightedOverall + 4);

  // Avoid hard-zero when there is meaningful candidate participation.
  if (evidence.candidateTurns >= 3 && evidence.candidateWordCount >= 30) {
    overallScore = Math.max(overallScore, 5);
  }

  const normalizedOverall = clampScore(overallScore, 0, 100);

  // Derive recommendation from overall score using strict bands
  let recommendation = String(input.recommendation || "").toLowerCase().trim();
  if (normalizedOverall >= 85) recommendation = "strong_hire";
  else if (normalizedOverall >= 65) recommendation = "hire";
  else if (normalizedOverall >= 40) recommendation = "maybe";
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
  if (overall >= 9.2) return "Strong Hire";
  if (overall >= 8.0) return "Hire";
  if (overall >= 5.8) return "No Hire";
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
    adjustedTechnical = Math.min(adjustedTechnical, 3);
  }

  if (!evidence.hasProblemSolvingDepth) {
    adjustedProblem = Math.min(adjustedProblem, 3);
  }

  if (!evidence.hasCodeDepth) {
    adjustedCodeQuality = Math.min(adjustedCodeQuality, 3);
  }

  if (!evidence.hasSystemDesignDepth) {
    adjustedSystemDesign = Math.min(adjustedSystemDesign, 3);
  }

  if (evidence.avgCandidateWords < 18 || evidence.candidateTurns < 4) {
    adjustedCommunication = Math.min(adjustedCommunication, 4);
    adjustedConfidence = Math.min(adjustedConfidence, 4);
  }

  if (evidence.hasResumeDeflection && !evidence.hasTechnicalDepth) {
    adjustedConfidence = Math.min(adjustedConfidence, 3.5);
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

  let constrainedOverall = adjustedOverall;
  if (!evidence.hasTechnicalDepth && !evidence.hasProblemSolvingDepth) {
    constrainedOverall = Math.min(constrainedOverall, 4.8);
  } else if (!evidence.hasTechnicalDepth || !evidence.hasProblemSolvingDepth) {
    constrainedOverall = Math.min(constrainedOverall, 6.0);
  }

  return {
    ...input,
    overallRating: clampScore(constrainedOverall, 1, 10),
    confidenceLevel: clampScore(adjustedConfidence, 1, 10),
    recommendation: recommendationFromOverall(constrainedOverall),
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
