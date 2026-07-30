"use client";

import { useState, useEffect } from "react";
import { Loader2, Zap, Plus, Search } from "lucide-react";
import BulkScreeningDashboard from "@/components/recruiter/BulkScreeningDashboard";
import JDConfigForm, { type JobConfig } from "@/components/recruiter/JDConfigForm";
import type { RecruitmentJob } from "@/types/recruiter";
import { toast } from "sonner";

export default function BulkScreeningWrapper({ initialJobId }: { initialJobId?: string }) {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || "");
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(!initialJobId);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/v2/recruiter/jobs");
        if (res.ok) {
          const data = await res.json();
          const activeJobs = (data.jobs || []).filter((j: RecruitmentJob) => j.status === "active");
          setJobs(activeJobs);
          
          if (!selectedJobId && activeJobs.length > 0 && !isCreatingNew) {
            setSelectedJobId(activeJobs[0].id);
          } else if (activeJobs.length === 0) {
            setIsCreatingNew(true);
          }
        }
      } catch (err) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [selectedJobId, isCreatingNew]);

  const handleCreateJob = async (config: JobConfig) => {
    setIsSubmittingJob(true);
    try {
      const res = await fetch("/api/v2/recruiter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: config.title,
          description: config.description,
          requiredSkills: config.requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
          experienceLevel: config.experienceLevel,
          type: "technical",
          status: "active",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create job context");
      }

      const data = await res.json();
      const newJobId = data.jobId;
      
      const newJob: RecruitmentJob = {
        id: newJobId,
        title: config.title,
        description: config.description,
        requiredSkills: config.requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
        experienceLevel: config.experienceLevel as any,
        type: "technical",
        status: "active",
        recruiterId: "", // stub
        companyName: "", // stub
        applicantIds: [],
        createdAt: new Date().toISOString(),
      };
      
      setJobs((prev) => [newJob, ...prev]);
      setSelectedJobId(newJobId);
      setIsCreatingNew(false);
      toast.success("Job context created successfully! You can now start screening.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating job");
    } finally {
      setIsSubmittingJob(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

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
        
        {!isCreatingNew && jobs.length > 0 && (
          <div className="flex items-end gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:w-64">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Target Job Role
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm appearance-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsCreatingNew(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 h-[38px]"
            >
              <Plus className="w-4 h-4" />
              New Job
            </button>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/[0.06]">
        {isCreatingNew ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Configure Job Requirements</h2>
                <p className="text-sm text-muted-foreground">Extract details from a JD or manually enter them.</p>
              </div>
              {jobs.length > 0 && (
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Select Existing Job
                </button>
              )}
            </div>

            {isSubmittingJob ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-foreground">Creating job context...</p>
              </div>
            ) : (
              <JDConfigForm 
                onJobConfigured={handleCreateJob} 
                onCancel={jobs.length > 0 ? () => setIsCreatingNew(false) : undefined} 
              />
            )}
          </div>
        ) : (
          selectedJobId && (
            <BulkScreeningDashboard
              jobId={selectedJobId}
              jobTitle={selectedJob?.title}
            />
          )
        )}
      </div>
    </div>
  );
}
