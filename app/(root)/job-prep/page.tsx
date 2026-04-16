"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRACTICE_COMPANY_PROFILES,
  PracticeCompanyKey,
  getPracticeCompanyProfile,
} from "@/constants/practice";
import {
  Briefcase,
  Target,
  ArrowRight,
  Sparkles,
  Code,
  Users,
  Building2,
  ChevronRight,
} from "lucide-react";

const focusAreas = [
  "Behavioral",
  "Core CS Fundamentals",
  "System Design",
  "Problem Solving",
  "Communication",
  "DSA / Coding",
  "Leadership",
];

const experienceLevels = [
  "Intern",
  "SDE-1 / New Grad",
  "SDE-2 / Mid-level",
  "Senior Engineer",
  "Staff / Principal",
  "Engineering Manager",
];

function JobPrepContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore from query params if available
  const [selectedCompany, setSelectedCompany] = useState<PracticeCompanyKey>(
    (searchParams.get("company") as PracticeCompanyKey) || "microsoft"
  );
  const [role, setRole] = useState(
    searchParams.get("role") || "Software Engineer"
  );
  const [experienceLevel, setExperienceLevel] = useState(
    searchParams.get("level") || "SDE-1 / New Grad"
  );
  const [selectedFocus, setSelectedFocus] = useState<string[]>(
    searchParams.get("focus")
      ? searchParams.get("focus")!.split(",")
      : ["Core CS Fundamentals", "Problem Solving"]
  );

  const profile = useMemo(
    () => getPracticeCompanyProfile(selectedCompany),
    [selectedCompany]
  );

  const toggleFocus = (area: string) => {
    setSelectedFocus((prev) => {
      if (prev.includes(area)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== area);
      }
      return [...prev, area];
    });
  };

  const handleStartInterview = () => {
    const params = new URLSearchParams({
      company: selectedCompany,
      role,
      level: experienceLevel,
      focus: selectedFocus.join(","),
      source: "job-prep",
    });
    router.push(`/interview?${params.toString()}`);
  };

  const handleStartDSA = () => {
    const params = new URLSearchParams({
      company: selectedCompany,
    });
    router.push(`/dsa-interview?${params.toString()}`);
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6 pt-28">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header */}
          <div className="animate-stagger-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Job Prep
                </h1>
                <p className="text-muted-foreground text-sm">
                  Tailored interview preparation for your dream role
                </p>
              </div>
            </div>
          </div>

          {/* Main config card */}
          <div className="glass-card p-8 md:p-10 rounded-3xl border border-white/10 animate-stagger-2">
            <h2 className="text-xl font-semibold mb-6 text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Configure Your Prep
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary/70" />
                  Target Company
                </label>
                <select
                  id="job-prep-company"
                  value={selectedCompany}
                  onChange={(e) =>
                    setSelectedCompany(e.target.value as PracticeCompanyKey)
                  }
                  className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  {PRACTICE_COMPANY_PROFILES.map((company) => (
                    <option key={company.key} value={company.key}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary/70" />
                  Target Role
                </label>
                <Input
                  id="job-prep-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Frontend Engineer, Backend SDE"
                  className="h-11 rounded-xl border-white/15 bg-white/[0.06]"
                />
              </div>

              {/* Experience Level */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary/70" />
                  Experience Level
                </label>
                <div className="flex flex-wrap gap-2">
                  {experienceLevels.map((level) => {
                    const active = experienceLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setExperienceLevel(level)}
                        className={`px-4 py-2 rounded-xl text-sm border transition-all duration-200 ${
                          active
                            ? "bg-primary/20 border-primary/40 text-primary font-medium shadow-[0_0_12px_rgba(157,125,249,0.15)]"
                            : "bg-white/[0.04] border-white/10 text-foreground/70 hover:bg-white/[0.08] hover:text-foreground"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Focus Areas */}
            <div className="mt-8">
              <p className="text-sm font-medium text-foreground/90 mb-3">
                Focus Areas
              </p>
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((area) => {
                  const active = selectedFocus.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleFocus(area)}
                      className={`px-4 py-2 rounded-full text-sm border transition-all duration-200 ${
                        active
                          ? "bg-primary/20 border-primary/40 text-primary font-medium"
                          : "bg-white/[0.04] border-white/10 text-foreground/70 hover:bg-white/[0.08]"
                      }`}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company Profile Preview */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Interview Style
                </p>
                <p className="text-foreground/90 text-sm leading-relaxed">
                  {profile.interviewStyle}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Behavioral Focus
                </p>
                <p className="text-foreground/90 text-sm leading-relaxed">
                  {profile.behavioralFocus.join(", ")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  DSA Patterns
                </p>
                <p className="text-foreground/90 text-sm leading-relaxed">
                  {profile.dsaPatterns.join(", ")}
                </p>
              </div>
            </div>

            {/* Start Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button
                id="job-prep-start-interview"
                onClick={handleStartInterview}
                className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-[0_0_20px_rgba(157,125,249,0.25)] hover:shadow-[0_0_30px_rgba(157,125,249,0.4)] transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Tailored Interview
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                id="job-prep-start-dsa"
                onClick={handleStartDSA}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] font-semibold text-base transition-all"
              >
                <Code className="w-5 h-5 mr-2" />
                Company DSA Practice
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          {/* Quick paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-stagger-3">
            <Link
              href="/dsa-interview"
              className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Code className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    DSA Problem Bank
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Browse popular problems by company, topic &amp; difficulty
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>

            <Link
              href="/interview"
              className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    General Practice
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Jump right in without company-specific context
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function JobPrepLoading() {
  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32">
        <div className="animate-pulse space-y-8 max-w-6xl mx-auto">
          <div className="h-12 bg-white/5 border border-white/10 rounded w-1/3 mb-8" />
          <div className="h-96 bg-white/5 border border-white/10 rounded-3xl" />
        </div>
      </div>
    </PageLayout>
  );
}

export default function JobPrepPage() {
  return (
    <Suspense fallback={<JobPrepLoading />}>
      <JobPrepContent />
    </Suspense>
  );
}
