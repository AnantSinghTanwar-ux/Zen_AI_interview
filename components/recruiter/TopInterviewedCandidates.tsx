"use client";

import { useState, useMemo } from "react";
import { Download, Trophy, Users } from "lucide-react";
import { Applicant } from "@/types/recruiter";
import { toast } from "sonner";

interface TopInterviewedCandidatesProps {
  applicants: Applicant[];
  jobTitle: string;
}

export default function TopInterviewedCandidates({
  applicants,
  jobTitle,
}: TopInterviewedCandidatesProps) {
  const [topN, setTopN] = useState<number>(5);

  // Filter only completed interviews and sort by score descending
  const sortedCandidates = useMemo(() => {
    return applicants
      .filter((a) => a.status === "completed" && typeof a.interviewScore === "number")
      .sort((a, b) => (b.interviewScore || 0) - (a.interviewScore || 0));
  }, [applicants]);

  const topCandidates = sortedCandidates.slice(0, topN);

  const downloadCSV = () => {
    if (topCandidates.length === 0) {
      toast.error("No interviewed candidates available to download.");
      return;
    }

    const headers = [
      "Rank",
      "Name",
      "Email",
      "Interview Score",
      "Recommendation",
      "Applied At",
    ];

    const rows = topCandidates.map((candidate, index) => [
      index + 1,
      `"${candidate.name.replace(/"/g, '""')}"`,
      `"${candidate.email.replace(/"/g, '""')}"`,
      candidate.interviewScore || 0,
      candidate.interviewRecommendation || "N/A",
      new Date(candidate.appliedAt).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `top_${topN}_interviewed_${jobTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Downloaded ${topCandidates.length} candidates as CSV`);
  };

  if (sortedCandidates.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Interviewed Candidates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Candidates who have completed their AI interview, sorted by score.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/5 rounded-xl px-3 py-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Top</span>
            <input
              type="number"
              min="1"
              max={sortedCandidates.length}
              value={topN}
              onChange={(e) => setTopN(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 bg-transparent text-sm text-foreground text-center outline-none"
            />
          </div>
          
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {topCandidates.map((candidate, idx) => (
          <div
            key={candidate.id}
            className="flex items-center justify-between p-4 rounded-xl bg-[#0A0A0A]/40 border border-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                #{idx + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                <p className="text-xs text-muted-foreground">{candidate.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {candidate.interviewRecommendation && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  candidate.interviewRecommendation === "strong_hire" || candidate.interviewRecommendation === "Strong Hire" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                  candidate.interviewRecommendation === "hire" || candidate.interviewRecommendation === "Hire" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                  candidate.interviewRecommendation === "maybe" || candidate.interviewRecommendation === "Maybe" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                  "bg-red-500/15 text-red-400 border-red-500/20"
                }`}>
                  {candidate.interviewRecommendation}
                </span>
              )}
              <div className="flex flex-col items-end">
                <span className="text-lg font-bold text-emerald-400">{candidate.interviewScore}</span>
                <span className="text-[10px] text-muted-foreground">score</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
