"use client";

import { useMemo } from "react";
import {
  FileSearch,
  Brain,
  BarChart3,
  Sparkles,
  Mail,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { ScreeningStage, ScreeningProgress } from "@/types/bulk-screening";

interface ScreeningProgressBarProps {
  stage: ScreeningStage;
  progress: ScreeningProgress;
  totalResumes: number;
  topN: number;
  message?: string;
  estimatedSecondsRemaining?: number;
}

interface StageConfig {
  key: ScreeningStage;
  label: string;
  icon: typeof FileSearch;
  getCount: (p: ScreeningProgress) => number;
  getTotal: (totalResumes: number, topN: number) => number;
}

const STAGES: StageConfig[] = [
  {
    key: "extracting",
    label: "Extracting",
    icon: FileSearch,
    getCount: (p) => p.extracted,
    getTotal: (t) => t,
  },
  {
    key: "embedding",
    label: "Embedding",
    icon: Brain,
    getCount: (p) => p.embedded,
    getTotal: (t) => t,
  },
  {
    key: "ranking",
    label: "Ranking",
    icon: BarChart3,
    getCount: (p) => p.semanticFiltered,
    getTotal: (_, topN) => topN * 2,
  },
  {
    key: "llm_scoring",
    label: "AI Scoring",
    icon: Sparkles,
    getCount: (p) => p.llmScored,
    getTotal: (_, topN) => topN * 2,
  },
  {
    key: "emailing",
    label: "Emailing",
    icon: Mail,
    getCount: (p) => p.emailed,
    getTotal: (_, topN) => topN,
  },
];

const STAGE_ORDER: ScreeningStage[] = [
  "uploading",
  "extracting",
  "embedding",
  "ranking",
  "llm_scoring",
  "emailing",
  "completed",
];

function getStageIndex(stage: ScreeningStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function formatETA(seconds: number): string {
  if (seconds < 0) return "";
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)}m remaining`;
  return `~${Math.ceil(seconds / 3600)}h remaining`;
}

export default function ScreeningProgressBar({
  stage,
  progress,
  totalResumes,
  topN,
  message,
  estimatedSecondsRemaining = -1,
}: ScreeningProgressBarProps) {
  const currentStageIndex = getStageIndex(stage);
  const isCompleted = stage === "completed";
  const isFailed = stage === "failed";

  // Overall progress percentage
  const overallPercent = useMemo(() => {
    if (isCompleted) return 100;
    if (isFailed) return 0;

    let totalWeight = 0;
    let completedWeight = 0;

    // Weight each stage relative to its workload
    const weights = [40, 20, 5, 25, 10]; // extraction, embedding, ranking, scoring, emailing

    for (let i = 0; i < STAGES.length; i++) {
      const s = STAGES[i];
      const weight = weights[i];
      totalWeight += weight;

      const stageIdx = getStageIndex(s.key);
      if (stageIdx < currentStageIndex) {
        // Stage is complete
        completedWeight += weight;
      } else if (stageIdx === currentStageIndex) {
        // Current stage — partial progress
        const count = s.getCount(progress);
        const total = s.getTotal(totalResumes, topN);
        const stagePercent = total > 0 ? Math.min(count / total, 1) : 0;
        completedWeight += weight * stagePercent;
      }
    }

    return totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;
  }, [stage, progress, totalResumes, topN, currentStageIndex, isCompleted, isFailed]);

  return (
    <div className="space-y-6">
      {/* Overall Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isFailed ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            )}
            <span
              className={`text-sm font-semibold ${
                isCompleted
                  ? "text-emerald-400"
                  : isFailed
                    ? "text-red-400"
                    : "text-foreground"
              }`}
            >
              {isCompleted
                ? "Screening Complete!"
                : isFailed
                  ? "Screening Failed"
                  : `Processing — ${overallPercent}%`}
            </span>
          </div>
          {estimatedSecondsRemaining > 0 && !isCompleted && !isFailed && (
            <span className="text-xs text-muted-foreground">
              {formatETA(estimatedSecondsRemaining)}
            </span>
          )}
        </div>

        {/* Main progress bar */}
        <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.04]">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isCompleted
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : isFailed
                  ? "bg-gradient-to-r from-red-600 to-red-500"
                  : "bg-gradient-to-r from-primary via-violet-500 to-purple-500"
            }`}
            style={{ width: `${overallPercent}%` }}
          />
        </div>

        {message && (
          <p className="text-xs text-muted-foreground mt-2">{message}</p>
        )}
      </div>

      {/* Stage Indicators */}
      <div className="flex items-start gap-0">
        {STAGES.map((s, i) => {
          const stageIdx = getStageIndex(s.key);
          const isActive = stageIdx === currentStageIndex;
          const isDone = stageIdx < currentStageIndex || isCompleted;
          const isPending = stageIdx > currentStageIndex && !isCompleted;
          const Icon = s.icon;

          const count = s.getCount(progress);
          const total = s.getTotal(totalResumes, topN);
          const stagePercent =
            isDone ? 100 : isActive && total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={s.key} className="flex-1 relative">
              {/* Connector Line */}
              {i > 0 && (
                <div
                  className={`absolute top-5 -left-1/2 w-full h-0.5 transition-colors duration-500 ${
                    isDone
                      ? "bg-emerald-500/50"
                      : isActive
                        ? "bg-gradient-to-r from-emerald-500/50 to-white/10"
                        : "bg-white/[0.06]"
                  }`}
                />
              )}

              {/* Stage Circle + Label */}
              <div className="relative flex flex-col items-center text-center">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    isDone
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      : isActive
                        ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_20px_rgba(99,102,241,0.2)] animate-pulse"
                        : "bg-white/[0.03] border-white/[0.06] text-muted-foreground/40"
                  } border`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  ) : isActive ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <Icon className="w-4.5 h-4.5" />
                  )}
                </div>

                <span
                  className={`text-[11px] font-medium mt-2 ${
                    isDone
                      ? "text-emerald-400"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {s.label}
                </span>

                {(isActive || isDone) && (
                  <span
                    className={`text-[10px] mt-0.5 ${
                      isDone ? "text-emerald-400/60" : "text-primary/60"
                    }`}
                  >
                    {isDone
                      ? `${total.toLocaleString()} ✓`
                      : `${count.toLocaleString()}/${total.toLocaleString()}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Stats Row */}
      {!isFailed && (
        <div className="grid grid-cols-5 gap-2">
          {[
            {
              label: "Extracted",
              value: progress.extracted,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Embedded",
              value: progress.embedded,
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Filtered",
              value: progress.semanticFiltered,
              color: "text-violet-400",
              bg: "bg-violet-500/10",
            },
            {
              label: "Scored",
              value: progress.llmScored,
              color: "text-amber-400",
              bg: "bg-amber-500/10",
            },
            {
              label: "Emailed",
              value: progress.emailed,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-xl px-3 py-2.5 text-center border border-white/[0.04]`}
            >
              <div className={`text-lg font-bold ${stat.color}`}>
                {stat.value.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
