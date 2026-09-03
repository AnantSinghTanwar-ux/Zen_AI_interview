"use client";

import { useState, useEffect } from "react";
import { RecruitmentJob } from "@/types/recruiter";
import { Briefcase, Users, Clock, Edit2, Trash2, Eye, MapPin, Zap } from "lucide-react";
import Link from "next/link";

interface JobCardProps {
  job: RecruitmentJob;
  onEdit?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  draft: { label: "Draft", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  closed: { label: "Closed", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const levelLabels: Record<string, string> = {
  junior: "Junior",
  mid: "Mid-Level",
  senior: "Senior",
  lead: "Lead",
};

export default function JobCard({ job, onEdit, onDelete }: JobCardProps) {
  const status = statusConfig[job.status] || statusConfig.draft;
  const skills = job.requiredSkills || [];
  const [applicantCount, setApplicantCount] = useState(job.applicantIds?.length || 0);
  const createdDate = new Date(job.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Fetch real applicant count from API (includes bulk candidates)
  useEffect(() => {
    fetch(`/api/v2/recruiter/jobs/${job.id}/applicants`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.total !== undefined) {
          setApplicantCount(data.total);
        }
      })
      .catch(() => {});
  }, [job.id]);

  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/40 hover:bg-[#FAFAFA]/[0.03] hover:border-white/10 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">
              {job.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {job.companyName}
              {job.location && (
                <span className="inline-flex items-center gap-0.5 ml-2">
                  <MapPin className="w-3 h-3" />
                  {job.location}
                </span>
              )}
            </p>
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${status.className}`}>
          {status.label}
        </span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {skills.slice(0, 5).map((skill) => (
          <span
            key={skill}
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-muted-foreground border border-white/5"
          >
            {skill}
          </span>
        ))}
        {skills.length > 5 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-primary border border-primary/20">
            +{skills.length - 5} more
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {applicantCount} applicant{applicantCount !== 1 ? "s" : ""}
          </span>
          <span>{levelLabels[job.experienceLevel] || job.experienceLevel}</span>
          <span className="capitalize">{job.type}</span>
        </div>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {createdDate}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        <Link
          href={`/recruiter/bulk-screening?jobId=${job.id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/10 px-3 py-1.5 rounded-lg transition-colors"
          title="Bulk Screen Candidates"
        >
          <Zap className="w-3.5 h-3.5" />
          Bulk Screen
        </Link>
        <Link
          href={`/recruiter/jobs/${job.id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Applicants
        </Link>
        {onEdit && job.status !== "closed" && (
          <button
            onClick={() => onEdit(job.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        {onDelete && job.status !== "closed" && (
          <button
            onClick={() => onDelete(job.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Close
          </button>
        )}
      </div>
    </div>
  );
}

