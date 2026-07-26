"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Briefcase, MapPin, Code, Clock, Users, Loader2,
  Filter, ArrowRight, Sparkles, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicJob {
  id: string;
  title: string;
  description: string;
  companyName: string;
  requiredSkills: string[];
  experienceLevel: string;
  type: string;
  location: string;
  salaryRange: { min: number; max: number } | null;
  deadline: string | null;
  applicantCount: number;
  createdAt: string;
}

const levelLabels: Record<string, string> = {
  junior: "Junior",
  mid: "Mid-Level",
  senior: "Senior",
  lead: "Lead",
};

export default function JobBoardClient() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (experienceFilter) params.set("experienceLevel", experienceFilter);
        if (typeFilter) params.set("type", typeFilter);

        const res = await fetch(`/api/v2/jobs?${params}`);
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error("Error fetching jobs:", err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchJobs, 300);
    return () => clearTimeout(debounce);
  }, [search, experienceFilter, typeFilter]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Target className="w-8 h-8 text-primary" />
          Job Board
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Find your next role. Apply with AI-powered resume screening.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search jobs, companies, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm rounded-xl w-full"
          />
        </div>

        <select
          value={experienceFilter}
          onChange={(e) => setExperienceFilter(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl w-full sm:w-auto"
        >
          <option value="">All Levels</option>
          <option value="junior">Junior</option>
          <option value="mid">Mid-Level</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl w-full sm:w-auto"
        >
          <option value="">All Types</option>
          <option value="technical">Technical</option>
          <option value="behavioral">Behavioral</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-lg text-muted-foreground font-medium">No jobs found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Try a different search term" : "Check back later for new opportunities"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {jobs.length} position{jobs.length !== 1 ? "s" : ""} available
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div className="group rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/40 p-5 hover:border-white/12 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full">
                  {/* Top */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{job.companyName}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                  </div>

                  {/* Description preview */}
                  <p className="text-xs text-foreground/60 leading-relaxed mb-3 line-clamp-2">
                    {job.description}
                  </p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.requiredSkills.slice(0, 4).map((skill) => (
                      <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-muted-foreground border border-white/5">
                        {skill}
                      </span>
                    ))}
                    {job.requiredSkills.length > 4 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        +{job.requiredSkills.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Code className="w-3 h-3" />
                      {levelLabels[job.experienceLevel] || job.experienceLevel}
                    </span>
                    <span className="capitalize">{job.type}</span>
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {job.applicantCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
