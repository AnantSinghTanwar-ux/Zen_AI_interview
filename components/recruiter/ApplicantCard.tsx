"use client";

import { Applicant, ScreeningResult } from "@/types/recruiter";
import { User, Mail, Award, ChevronDown, ThumbsUp, ThumbsDown, Eye, MessageSquare } from "lucide-react";
import { useState } from "react";

interface ApplicantCardProps {
  applicant: Applicant & { results?: ScreeningResult };
  onStatusChange: (applicantId: string, status: string) => void;
}

export default function ApplicantCard({ applicant, onStatusChange }: ApplicantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const results = applicant.results;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    invited: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    in_progress: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    completed: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    shortlisted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-white/15 hover:shadow-[0_0_20px_rgba(157,125,249,0.06)]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {applicant.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {applicant.name}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{applicant.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {results && (
            <span className={`text-lg font-bold ${scoreColor(results.overallScore)}`}>
              {results.overallScore}
            </span>
          )}
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              statusColors[applicant.status] || statusColors.pending
            }`}
          >
            {applicant.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Score Bars (if results exist) */}
      {results && (
        <div className="px-4 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Technical", score: results.technicalScore },
              { label: "Communication", score: results.communicationScore },
              { label: "Problem Solving", score: results.problemSolvingScore },
            ].map(({ label, score }) => (
              <div key={label}>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>{label}</span>
                  <span>{score}</span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand for details */}
      {results && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-1.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-t border-white/5"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && results && (
        <div className="px-4 pb-3 space-y-2 text-xs border-t border-white/5 pt-2">
          {results.recommendation && (
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground capitalize">
                AI Recommendation: {results.recommendation}
              </span>
            </div>
          )}
          {results.strengths?.length > 0 && (
            <div>
              <p className="text-muted-foreground font-medium mb-1">Strengths:</p>
              <ul className="space-y-0.5 text-foreground/80">
                {results.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">•</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.weaknesses?.length > 0 && (
            <div>
              <p className="text-muted-foreground font-medium mb-1">Areas to Improve:</p>
              <ul className="space-y-0.5 text-foreground/80">
                {results.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.feedbackSummary && (
            <div className="flex items-start gap-2 mt-1.5 p-2 rounded-lg bg-white/[0.03]">
              <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-foreground/80 leading-relaxed">{results.feedbackSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2">
        {applicant.status !== "shortlisted" && (
          <button
            onClick={() => onStatusChange(applicant.id, "shortlisted")}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ThumbsUp className="w-3.5 h-3.5" /> Shortlist
          </button>
        )}
        {applicant.status !== "rejected" && (
          <button
            onClick={() => onStatusChange(applicant.id, "rejected")}
            className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ThumbsDown className="w-3.5 h-3.5" /> Reject
          </button>
        )}
        {applicant.resumeUrl && (
          <a
            href={applicant.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <Eye className="w-3.5 h-3.5" /> Resume
          </a>
        )}
      </div>
    </div>
  );
}
