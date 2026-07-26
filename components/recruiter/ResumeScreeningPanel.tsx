"use client";

import type { ResumeScreeningResult } from "@/types/recruiter";
import { Sparkles, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ResumeScreeningPanelProps {
  screening: ResumeScreeningResult;
}

const recConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  shortlist: {
    label: "Shortlist",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  },
  review: {
    label: "Review",
    icon: AlertCircle,
    className: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    className: "bg-red-500/15 border-red-500/30 text-red-400",
  },
};

function scoreColor(s: number): string {
  if (s >= 70) return "text-emerald-400";
  if (s >= 50) return "text-yellow-400";
  if (s >= 30) return "text-orange-400";
  return "text-red-400";
}

function scoreBarColor(s: number): string {
  if (s >= 70) return "bg-emerald-500";
  if (s >= 50) return "bg-yellow-500";
  if (s >= 30) return "bg-orange-500";
  return "bg-red-500";
}

export default function ResumeScreeningPanel({ screening }: ResumeScreeningPanelProps) {
  const rec = recConfig[screening.recommendation] || recConfig.review;
  const RecIcon = rec.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-foreground">AI Resume Screening</h3>
      </div>

      {/* Score + Recommendation */}
      <div className="flex items-center gap-4">
        {/* Overall Score Ring */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="absolute w-16 h-16 transform -rotate-90">
            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white/5" />
            <circle
              cx="32" cy="32" r="26"
              stroke="currentColor" strokeWidth="3" fill="transparent"
              className={`${scoreColor(screening.overallScore)} drop-shadow-[0_0_8px_rgba(163,230,53,0.4)]`}
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min(screening.overallScore, 100) / 100)}
              strokeLinecap="round"
            />
          </svg>
          <span className={`relative z-10 text-lg font-bold ${scoreColor(screening.overallScore)}`}>
            {screening.overallScore}
          </span>
        </div>

        <div className="flex-1">
          {/* Skill Match Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Skill Match</span>
              <span className={scoreColor(screening.skillMatchPercent)}>{screening.skillMatchPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(screening.skillMatchPercent)}`}
                style={{ width: `${screening.skillMatchPercent}%` }}
              />
            </div>
          </div>

          {/* Recommendation badge */}
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${rec.className}`}>
            <RecIcon className="w-3 h-3" />
            {rec.label}
          </span>
        </div>
      </div>

      {/* Matched Skills */}
      {screening.matchedSkills.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-400 mb-1.5">Matched Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {screening.matchedSkills.map((skill) => (
              <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Skills */}
      {screening.missingSkills.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-red-400 mb-1.5">Missing Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {screening.missingSkills.map((skill) => (
              <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {screening.strengths.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-emerald-400">Strengths</p>
          {screening.strengths.map((s, i) => (
            <p key={i} className="text-xs text-foreground/70 pl-3 border-l-2 border-emerald-500/30">{s}</p>
          ))}
        </div>
      )}

      {/* Weaknesses */}
      {screening.weaknesses.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-red-400">Weaknesses</p>
          {screening.weaknesses.map((w, i) => (
            <p key={i} className="text-xs text-foreground/70 pl-3 border-l-2 border-red-500/30">{w}</p>
          ))}
        </div>
      )}

      {/* Summary */}
      {screening.summary && (
        <div className="p-3 rounded-lg bg-white/[0.03] text-xs text-foreground/80 leading-relaxed border-l-2 border-violet-500/30">
          <p className="text-[11px] font-semibold text-violet-400 mb-1">AI Assessment</p>
          {screening.summary}
        </div>
      )}
    </div>
  );
}
