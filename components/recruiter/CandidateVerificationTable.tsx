"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  MailCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Download,
} from "lucide-react";
import type { ScreenedCandidateRow } from "@/types/bulk-screening";

interface CandidateVerificationTableProps {
  candidates: ScreenedCandidateRow[];
  totalCandidates: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onSearch: (query: string) => void;
  onViewCandidate?: (candidateId: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  searchQuery: string;
  loading?: boolean;
  stats?: {
    totalCandidates: number;
    shortlistedCount: number;
    emailedCount: number;
    averageScore: number;
  };
}

const recConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  shortlist: {
    label: "Shortlist",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  review: {
    label: "Review",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-white/[0.03]";
  if (score >= 70) return "bg-emerald-500/10";
  if (score >= 50) return "bg-yellow-500/10";
  if (score >= 30) return "bg-orange-500/10";
  return "bg-red-500/10";
}

export default function CandidateVerificationTable({
  candidates,
  totalCandidates,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onSort,
  onSearch,
  onViewCandidate,
  sortBy,
  sortOrder,
  searchQuery,
  loading = false,
  stats,
}: CandidateVerificationTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSortClick = (field: string) => {
    if (sortBy === field) {
      onSort(field, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSort(field, "desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field)
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Total Candidates",
              value: stats.totalCandidates,
              color: "text-blue-400",
            },
            {
              label: "Shortlisted",
              value: stats.shortlistedCount,
              color: "text-emerald-400",
            },
            {
              label: "Emails Sent",
              value: stats.emailedCount,
              color: "text-violet-400",
            },
            {
              label: "Avg Score",
              value: stats.averageScore,
              color: scoreColor(stats.averageScore),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white/[0.02] rounded-xl border border-white/[0.04] px-4 py-3"
            >
              <div className={`text-xl font-bold ${s.color}`}>
                {s.value.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or filename..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.06] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-card/60 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {[
                  { key: "rank", label: "#", width: "w-12" },
                  { key: "name", label: "Candidate", width: "w-auto" },
                  { key: "llmScore", label: "Score", width: "w-20" },
                  {
                    key: "skillMatchPercent",
                    label: "Skill Match",
                    width: "w-24",
                  },
                  { key: "recommendation", label: "Verdict", width: "w-28" },
                  { key: "email_status", label: "Email", width: "w-20" },
                  { key: "actions", label: "", width: "w-16" },
                ].map(({ key, label, width }) => (
                  <th
                    key={key}
                    className={`${width} px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
                      key !== "actions" && key !== "email_status"
                        ? "cursor-pointer hover:text-foreground transition-colors"
                        : ""
                    }`}
                    onClick={() => {
                      if (key !== "actions" && key !== "email_status") {
                        handleSortClick(key);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      {key !== "actions" && key !== "email_status" && (
                        <SortIcon field={key} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Loading candidates...
                    </div>
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No candidates found
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  const rec = recConfig[candidate.recommendation || ""] || null;
                  const RecIcon = rec?.icon || AlertCircle;
                  const isExpanded = expandedRow === candidate.id;

                  return (
                    <>
                      <tr
                        key={candidate.id}
                        className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${
                          candidate.isShortlisted
                            ? "bg-emerald-500/[0.02]"
                            : ""
                        }`}
                        onClick={() =>
                          setExpandedRow(isExpanded ? null : candidate.id)
                        }
                      >
                        {/* Rank */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-mono font-bold ${
                              candidate.rank <= 3
                                ? "text-amber-400"
                                : candidate.rank <= 10
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {candidate.rank}
                          </span>
                        </td>

                        {/* Candidate Info */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {candidate.name || candidate.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {candidate.email || "No email found"}
                            </p>
                          </div>
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3">
                          <div
                            className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-bold ${scoreColor(candidate.llmScore)} ${scoreBg(candidate.llmScore)}`}
                          >
                            {candidate.llmScore ?? "—"}
                          </div>
                        </td>

                        {/* Skill Match */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (candidate.skillMatchPercent ?? 0) >= 70
                                    ? "bg-emerald-500"
                                    : (candidate.skillMatchPercent ?? 0) >= 40
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${candidate.skillMatchPercent || 0}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium ${scoreColor(candidate.skillMatchPercent)}`}
                            >
                              {candidate.skillMatchPercent ?? "—"}%
                            </span>
                          </div>
                        </td>

                        {/* Verdict */}
                        <td className="px-4 py-3">
                          {rec ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${rec.className}`}
                            >
                              <RecIcon className="w-3 h-3" />
                              {rec.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>

                        {/* Interview Score */}
                        <td className="px-4 py-3">
                          <div
                            className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-bold ${scoreColor(candidate.interviewScore || null)} ${scoreBg(candidate.interviewScore || null)}`}
                          >
                            {candidate.interviewScore ?? "—"}
                          </div>
                        </td>

                        {/* Email Status */}
                        <td className="px-4 py-3">
                          {candidate.emailSentAt ? (
                            <MailCheck className="w-4 h-4 text-emerald-400" />
                          ) : candidate.email ? (
                            <Mail className="w-4 h-4 text-muted-foreground/30" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400/30" />
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {onViewCandidate && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewCandidate(candidate.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {candidate.interviewLink && (
                              <a
                                href={candidate.interviewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-primary transition-colors"
                                title="Open interview link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr key={`${candidate.id}-detail`}>
                          <td colSpan={8} className="px-6 py-4 bg-white/[0.01]">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Assessment */}
                              <div className="space-y-6">
                                {candidate.assessmentSummary && (
                                  <div>
                                    <h4 className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider mb-2">
                                      Resume AI Assessment
                                    </h4>
                                    <p className="text-sm text-foreground/70 leading-relaxed">
                                      {candidate.assessmentSummary}
                                    </p>
                                  </div>
                                )}
                                
                                {candidate.interviewFeedback && (
                                  <div>
                                    <h4 className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">
                                      Live Interview Feedback
                                    </h4>
                                    <p className="text-sm text-foreground/70 leading-relaxed">
                                      {candidate.interviewFeedback}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Skills */}
                              <div className="space-y-3">
                                {candidate.matchedSkills.length > 0 && (
                                  <div>
                                    <h4 className="text-[11px] font-semibold text-emerald-400 mb-1.5">
                                      Matched Skills
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {candidate.matchedSkills.map((s) => (
                                        <span
                                          key={s}
                                          className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {candidate.missingSkills.length > 0 && (
                                  <div>
                                    <h4 className="text-[11px] font-semibold text-red-400 mb-1.5">
                                      Missing Skills
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {candidate.missingSkills.map((s) => (
                                        <span
                                          key={s}
                                          className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Contact Details */}
                              <div className="col-span-2 flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t border-white/[0.04]">
                                {candidate.phone && (
                                  <span>📞 {candidate.phone}</span>
                                )}
                                {candidate.linkedIn && (
                                  <a
                                    href={
                                      candidate.linkedIn.startsWith("http")
                                        ? candidate.linkedIn
                                        : `https://${candidate.linkedIn}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    LinkedIn Profile ↗
                                  </a>
                                )}
                                <span className="text-muted-foreground/40">
                                  {candidate.fileName}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, totalCandidates)} of{" "}
              {totalCandidates.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`w-8 h-8 text-xs font-medium rounded-lg transition-all ${
                      pageNum === page
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
