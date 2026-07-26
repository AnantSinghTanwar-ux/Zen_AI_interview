"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, Briefcase, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import JobCard from "./JobCard";
import type { RecruitmentJob } from "@/types/recruiter";

export default function JobManagementDashboard() {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/recruiter/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to close this job posting?")) return;
    try {
      const res = await fetch(`/api/v2/recruiter/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to close job");
      toast.success("Job posting closed");
      fetchJobs();
    } catch {
      toast.error("Failed to close job posting");
    }
  };

  const handleEdit = (jobId: string) => {
    window.location.href = `/recruiter/jobs/${jobId}?edit=true`;
  };

  const filteredJobs = search.trim()
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(search.toLowerCase()) ||
          j.companyName.toLowerCase().includes(search.toLowerCase())
      )
    : jobs;

  const activeCount = jobs.filter((j) => j.status === "active").length;
  const draftCount = jobs.filter((j) => j.status === "draft").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Job Postings
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-emerald-400 font-medium">{activeCount} active</span>
            <span className="text-xs text-yellow-400 font-medium">{draftCount} draft</span>
            <span className="text-xs text-muted-foreground">{closedCount} closed</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl w-full sm:w-56"
            />
          </div>
          <Button
            onClick={() => (window.location.href = "/recruiter/jobs/new")}
            className="rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Job
          </Button>
        </div>
      </div>

      {/* Job Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No jobs match your search" : "No job postings yet"}
          </p>
          {!search && (
            <Button
              onClick={() => (window.location.href = "/recruiter/jobs/new")}
              variant="outline"
              className="mt-4 rounded-xl border-white/10"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create your first job posting
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
