"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Briefcase, Users, CheckCircle2, XCircle, BarChart3,
  Plus, Upload, Send, Download, ChevronRight, Loader2,
  Building2, TrendingUp, Clock, Filter,
} from "lucide-react";
import { RecruitmentJob, Applicant, ScreeningResult, RecruiterDashboardStats } from "@/types/recruiter";
import ApplicantCard from "./ApplicantCard";
import ApplicantUploader from "./ApplicantUploader";
import JobForm from "./JobForm";

type ViewMode = "dashboard" | "create-job" | "import" | "pipeline";

export default function RecruiterDashboard() {
  const [view, setView] = useState<ViewMode>("dashboard");
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applicants, setApplicants] = useState<(Applicant & { results?: ScreeningResult })[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/recruiter/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/recruiter/dashboard");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch { /* ignore */ }
  }, []);

  const fetchApplicants = useCallback(async (jobId: string) => {
    setLoadingApplicants(true);
    try {
      const url = statusFilter && statusFilter !== "all"
        ? `/api/v2/recruiter/applicants?jobId=${jobId}&status=${statusFilter}`
        : `/api/v2/recruiter/applicants?jobId=${jobId}`;
      const res = await fetch(url);
      if (res.ok) {
        setApplicants(await res.json());
      }
    } catch { /* ignore */ } finally {
      setLoadingApplicants(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    Promise.all([fetchJobs(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchJobs, fetchStats]);

  useEffect(() => {
    if (selectedJobId) fetchApplicants(selectedJobId);
  }, [selectedJobId, fetchApplicants]);

  const handleJobCreated = () => {
    setView("dashboard");
    fetchJobs();
    fetchStats();
  };

  const handleImportSuccess = () => {
    setView("pipeline");
    if (selectedJobId) fetchApplicants(selectedJobId);
    fetchStats();
  };

  const handleStatusChange = async (applicantId: string, status: string) => {
    try {
      const res = await fetch("/api/v2/recruiter/applicants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, status }),
      });

      if (res.ok) {
        toast.success(`Applicant ${status === "shortlisted" ? "shortlisted" : "rejected"}`);
        if (selectedJobId) fetchApplicants(selectedJobId);
        fetchStats();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleAssignAll = async () => {
    const pending = applicants.filter((a) => a.status === "pending");
    if (pending.length === 0) {
      toast.error("No pending applicants to assign");
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch("/api/v2/recruiter/screening/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          applicantIds: pending.map((a) => a.id),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(
          `Assigned ${result.assigned} interview${result.assigned !== 1 ? "s" : ""}${
            result.failed ? ` (${result.failed} failed)` : ""
          }`
        );
        fetchApplicants(selectedJobId);
        fetchStats();
      } else {
        toast.error(result.error || "Failed to assign interviews");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAssigning(false);
    }
  };

  const handleExport = async () => {
    if (!selectedJobId) return;

    try {
      const res = await fetch("/api/v2/recruiter/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shortlisted_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export downloaded!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Nothing to export");
      }
    } catch {
      toast.error("Export failed");
    }
  };

  // Group applicants by status for pipeline view
  const pipeline = {
    pending: applicants.filter((a) => a.status === "pending"),
    invited: applicants.filter((a) => a.status === "invited"),
    completed: applicants.filter((a) => a.status === "completed"),
    shortlisted: applicants.filter((a) => a.status === "shortlisted"),
    rejected: applicants.filter((a) => a.status === "rejected"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Recruiter Dashboard
          </h1>
          {stats?.recruiter && (
            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4" />
              {stats.recruiter.companyName} · {stats.recruiter.industry}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("create-job")}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-all"
          >
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Jobs", value: stats.totalJobs, icon: Briefcase, color: "text-primary" },
            { label: "Total Applicants", value: stats.totalApplicants, icon: Users, color: "text-blue-400" },
            { label: "Shortlisted", value: stats.byStatus?.shortlisted || 0, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Avg Score", value: stats.averageScore || "—", icon: TrendingUp, color: "text-yellow-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Job View */}
      {view === "create-job" && (
        <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm p-8">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Create New Job Posting
          </h2>
          <JobForm onSuccess={handleJobCreated} onCancel={() => setView("dashboard")} />
        </div>
      )}

      {/* Import View */}
      {view === "import" && selectedJobId && (
        <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm p-8">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Applicants
          </h2>
          <ApplicantUploader jobId={selectedJobId} onSuccess={handleImportSuccess} />
        </div>
      )}

      {/* Jobs List & Pipeline */}
      {(view === "dashboard" || view === "pipeline") && (
        <>
          {/* Job Selector */}
          {jobs.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Your Jobs</h2>
                <div className="flex items-center gap-2">
                  {selectedJobId && (
                    <>
                      <button
                        onClick={() => setView("import")}
                        className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg transition-all hover:border-white/20"
                      >
                        <Upload className="w-3.5 h-3.5" /> Import CSV
                      </button>
                      <button
                        onClick={handleAssignAll}
                        disabled={assigning || pipeline.pending.length === 0}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        {assigning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Assign Interviews ({pipeline.pending.length})
                      </button>
                      <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-lg transition-all hover:border-white/20"
                      >
                        <Download className="w-3.5 h-3.5" /> Export
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setView("pipeline");
                    }}
                    className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                      selectedJobId === job.id
                        ? "border-primary/40 bg-primary/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {job.title}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {job.applicantIds?.length || 0} applicants
                      </span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        job.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                        job.status === "closed" ? "bg-red-500/15 text-red-400" :
                        "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {job.status}
                      </span>
                      <span className="capitalize">{job.experienceLevel}</span>
                    </div>
                    {job.requiredSkills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.requiredSkills.slice(0, 4).map((s) => (
                          <span key={s} className="text-[10px] bg-white/[0.04] text-muted-foreground px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                        {job.requiredSkills.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{job.requiredSkills.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline View */}
          {view === "pipeline" && selectedJobId && (
            <div className="space-y-6">
              {/* Pipeline Header with filter */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">
                  Applicant Pipeline
                </h2>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 appearance-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="invited">Invited</option>
                    <option value="completed">Completed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {loadingApplicants ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : applicants.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-white/10 bg-card/60">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-1">No applicants yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Import applicants via CSV to get started</p>
                  <button
                    onClick={() => setView("import")}
                    className="bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 py-2 rounded-full transition-all"
                  >
                    Import Applicants
                  </button>
                </div>
              ) : (
                /* Kanban columns */
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {(["pending", "invited", "completed", "shortlisted", "rejected"] as const).map((status) => {
                    const items = pipeline[status];
                    const colors: Record<string, string> = {
                      pending: "border-yellow-500/30",
                      invited: "border-blue-500/30",
                      completed: "border-cyan-500/30",
                      shortlisted: "border-emerald-500/30",
                      rejected: "border-red-500/30",
                    };
                    return (
                      <div key={status}>
                        <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${colors[status]}`}>
                          <span className="text-sm font-medium text-foreground capitalize">
                            {status.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded-full">
                            {items.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {items.map((applicant) => (
                            <ApplicantCard
                              key={applicant.id}
                              applicant={applicant}
                              onStatusChange={handleStatusChange}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty State — No jobs */}
          {jobs.length === 0 && view === "dashboard" && (
            <div className="text-center py-20 rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm">
              <Briefcase className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Create your first job</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Post a job, import applicants via CSV, and let ZenAI auto-generate
                personalized interviews for each candidate.
              </p>
              <button
                onClick={() => setView("create-job")}
                className="bg-primary hover:bg-primary/90 text-white text-sm font-medium px-6 py-3 rounded-full transition-all"
              >
                <Plus className="w-4 h-4 inline mr-2" /> Create Job
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
