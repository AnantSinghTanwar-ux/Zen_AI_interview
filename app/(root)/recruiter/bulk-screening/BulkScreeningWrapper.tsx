"use client";

import { useState, useEffect } from "react";
import { Loader2, Zap } from "lucide-react";
import BulkScreeningDashboard from "@/components/recruiter/BulkScreeningDashboard";
import type { RecruitmentJob } from "@/types/recruiter";

export default function BulkScreeningWrapper({ initialJobId }: { initialJobId?: string }) {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || "");

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/v2/recruiter/jobs");
        if (res.ok) {
          const data = await res.json();
          const activeJobs = (data.jobs || []).filter((j: RecruitmentJob) => j.status === "active");
          setJobs(activeJobs);
          
          if (!selectedJobId && activeJobs.length > 0) {
            setSelectedJobId(activeJobs[0].id);
          }
        }
      } catch (err) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [selectedJobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 bg-card/60 rounded-3xl border border-white/5">
        <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-foreground mb-2">No Active Jobs</h2>
        <p className="text-muted-foreground">
          You need an active job posting to use the bulk screening engine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Bulk Resume Screening
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload thousands of resumes, rank them using AI, and automatically schedule interviews.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Target Job Role
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm appearance-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          >
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedJobId && (
        <div className="pt-4 border-t border-white/[0.06]">
          <BulkScreeningDashboard
            jobId={selectedJobId}
            jobTitle={selectedJob?.title}
          />
        </div>
      )}
    </div>
  );
}
