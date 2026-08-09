"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Search, Users, Loader2, ChevronDown,
  CheckCircle2, XCircle, Calendar, Eye, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import ResumeScreeningPanel from "./ResumeScreeningPanel";
import ScheduleInterviewModal from "./ScheduleInterviewModal";
import TopInterviewedCandidates from "./TopInterviewedCandidates";
import type { Applicant, ResumeScreeningResult, RecruitmentJob } from "@/types/recruiter";

interface EnrichedApplicant extends Applicant {
  screening: ResumeScreeningResult | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
  screening: { label: "Screening", className: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  screened: { label: "Screened", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  invited: { label: "Invited", className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
  in_progress: { label: "In Progress", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  shortlisted: { label: "Shortlisted", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export default function JobApplicantManager({ jobId }: { jobId: string }) {
  const [applicants, setApplicants] = useState<EnrichedApplicant[]>([]);
  const [job, setJob] = useState<{ id: string; title: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score" | "name">("date");
  const [selectedApplicant, setSelectedApplicant] = useState<EnrichedApplicant | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<EnrichedApplicant | null>(null);

  const fetchApplicants = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (sortBy) params.set("sort", sortBy);

      const res = await fetch(`/api/v2/recruiter/jobs/${jobId}/applicants?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setApplicants(data.applicants || []);
      if (data.job) setJob(data.job);
    } catch (err) {
      console.error("Error fetching applicants:", err);
      toast.error("Failed to load applicants");
    } finally {
      setLoading(false);
    }
  }, [jobId, statusFilter, search, sortBy]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const handleStatusChange = async (applicantId: string, status: string) => {
    try {
      const res = await fetch(`/api/v2/recruiter/jobs/${jobId}/applicants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Status updated to ${status}`);
      fetchApplicants();
      if (selectedApplicant?.id === applicantId) {
        setSelectedApplicant(null);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const renderApplicantRow = (applicant: EnrichedApplicant, isResumeOnly: boolean = false) => {
    const status = statusConfig[applicant.status] || statusConfig.pending;
    const hasScreening = !!applicant.screening;

    return (
      <div
        key={applicant.id}
        className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/40 hover:border-white/10 transition-all overflow-hidden"
      >
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Score badges */}
            <div className="flex gap-2 shrink-0">
              {/* Interview Score (Primary if exists) */}
              {applicant.interviewScore !== undefined && applicant.interviewScore !== null ? (
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0 shadow-[0_0_10px_rgba(163,230,53,0.1)]">
                  <span className="text-sm font-bold text-primary">
                    {applicant.interviewScore}
                  </span>
                  <span className="text-[8px] text-primary/70 uppercase font-semibold">Intv</span>
                </div>
              ) : null}
              
              {/* Resume Score */}
              {hasScreening ? (
                <div className={`w-12 h-12 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col items-center justify-center shrink-0 ${applicant.interviewScore ? 'hidden sm:flex' : ''}`}>
                  <span className={`text-sm font-bold ${
                    applicant.screening!.overallScore >= 70 ? "text-emerald-400" :
                    applicant.screening!.overallScore >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {applicant.screening!.overallScore}
                  </span>
                  <span className="text-[8px] text-muted-foreground uppercase font-semibold">Resume</span>
                </div>
              ) : !applicant.interviewScore && (
                <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0">
                   <span className="text-[10px] text-muted-foreground">—</span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{applicant.name}</p>
              <p className="text-xs text-muted-foreground truncate">{applicant.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Recommendation Pill */}
            {applicant.interviewRecommendation ? (
              <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                applicant.interviewRecommendation.toLowerCase().includes("strong") ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                applicant.interviewRecommendation.toLowerCase().includes("hire") ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                applicant.interviewRecommendation.toLowerCase().includes("maybe") ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                "bg-red-500/15 text-red-400 border-red-500/30"
              }`}>
                {applicant.interviewRecommendation.replace("_", " ")}
              </span>
            ) : hasScreening && applicant.screening!.recommendation ? (
              <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                applicant.screening!.recommendation === "shortlist" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                applicant.screening!.recommendation === "review" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                "bg-red-500/15 text-red-400 border-red-500/20"
              }`}>
                {applicant.screening!.recommendation}
              </span>
            ) : null}

            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.className}`}>
              {status.label}
            </span>

            <button
              onClick={() => setSelectedApplicant(selectedApplicant?.id === applicant.id ? null : applicant)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded Detail */}
        {selectedApplicant?.id === applicant.id && (
          <div className="border-t border-white/5 p-5 bg-white/[0.01] space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: AI Screening */}
              <div>
                {applicant.screening ? (
                  <ResumeScreeningPanel screening={applicant.screening} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI screening pending...
                  </div>
                )}
              </div>

              {/* Right: Info + Actions */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Application Info</h4>
                  <div className="space-y-1.5 text-sm">
                    <p className="text-foreground/80">
                      <span className="text-muted-foreground">Applied:</span>{" "}
                      {new Date(applicant.appliedAt).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                    {applicant.coverLetter && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Cover Letter:</p>
                        <p className="text-xs text-foreground/70 bg-white/[0.03] p-3 rounded-lg border border-white/5 max-h-32 overflow-y-auto">
                          {applicant.coverLetter}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {applicant.status !== "shortlisted" && applicant.status !== "rejected" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(applicant.id, "shortlisted")}
                          className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 px-3 py-2 rounded-lg hover:bg-emerald-500/25 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Shortlist
                        </button>
                        <button
                          onClick={() => handleStatusChange(applicant.id, "rejected")}
                          className="flex items-center gap-1.5 text-xs font-medium bg-red-500/15 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/25 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    {(applicant.status === "shortlisted" || applicant.status === "screened") && (
                      <button
                        onClick={() => setScheduleTarget(applicant)}
                        className="flex items-center gap-1.5 text-xs font-medium bg-primary/15 text-primary px-3 py-2 rounded-lg hover:bg-primary/25 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Schedule Interview
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/recruiter"
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{job?.title || "Job Applicants"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm rounded-xl w-full"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusConfig).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm rounded-xl w-full sm:w-auto"
        >
          <option value="date">Sort by Date</option>
          <option value="score">Sort by Score</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Two distinct lists */}
      <div className="space-y-12">
        {/* Main Section: Interviewed Candidates */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
            <h2 className="text-xl font-bold text-foreground">Interviewed Candidates</h2>
            <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {applicants.filter(a => a.interviewScore !== undefined && a.interviewScore !== null).length}
            </span>
          </div>

          {applicants.filter(a => a.interviewScore !== undefined && a.interviewScore !== null).length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <p className="text-sm text-muted-foreground">No interviewed candidates yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applicants
                .filter(a => a.interviewScore !== undefined && a.interviewScore !== null)
                .sort((a, b) => {
                  if (sortBy === "score") return (b.interviewScore || 0) - (a.interviewScore || 0);
                  if (sortBy === "name") return a.name.localeCompare(b.name);
                  return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
                })
                .map((applicant) => renderApplicantRow(applicant))}
            </div>
          )}
        </div>

        {/* Secondary Section: Resume Screened Candidates */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
            <h2 className="text-lg font-bold text-muted-foreground">Resume Candidates</h2>
            <span className="bg-white/10 text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {applicants.filter(a => applicant.interviewScore === undefined || applicant.interviewScore === null).length}
            </span>
          </div>

          {applicants.filter(a => applicant.interviewScore === undefined || applicant.interviewScore === null).length === 0 ? (
            <div className="text-center py-8 rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
              <p className="text-sm text-muted-foreground">No resume candidates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applicants
                .filter(a => a.interviewScore === undefined || a.interviewScore === null)
                .sort((a, b) => {
                  if (sortBy === "score") return (b.screening?.overallScore || 0) - (a.screening?.overallScore || 0);
                  if (sortBy === "name") return a.name.localeCompare(b.name);
                  return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
                })
                .map((applicant) => renderApplicantRow(applicant, true))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {scheduleTarget && job && (
        <ScheduleInterviewModal
          applicantId={scheduleTarget.id}
          applicantName={scheduleTarget.name}
          jobId={jobId}
          jobTitle={job.title}
          onClose={() => setScheduleTarget(null)}
          onScheduled={fetchApplicants}
        />
      )}
    </div>
  );
}
