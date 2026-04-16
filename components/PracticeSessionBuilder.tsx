"use client";

import { useMemo, useState } from "react";
import Agent from "@/components/Agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRACTICE_COMPANY_PROFILES,
  PracticeCompanyKey,
  getPracticeCompanyProfile,
} from "@/constants/practice";

interface PracticeSessionBuilderProps {
  userName: string;
  userId: string;
  jobContextJson?: string;
  initialPracticeContextJson?: string;
  autoStart?: boolean;
}

const focusAreas = [
  "Behavioral",
  "Core CS Fundamentals",
  "System Design",
  "Problem Solving",
  "Communication",
];

export default function PracticeSessionBuilder({
  userName,
  userId,
  jobContextJson,
  initialPracticeContextJson,
  autoStart,
}: PracticeSessionBuilderProps) {
  const [selectedCompany, setSelectedCompany] =
    useState<PracticeCompanyKey>("microsoft");
  const [role, setRole] = useState("Software Engineer");
  const [experienceLevel, setExperienceLevel] = useState("SDE-1 / Early Career");
  const [selectedFocus, setSelectedFocus] = useState<string[]>([
    "Core CS Fundamentals",
    "Problem Solving",
  ]);
  // Auto-start if coming from Job Prep, OR if triggered via LinkedIn extension (jobContextJson present)
  const [started, setStarted] = useState((autoStart === true && !!initialPracticeContextJson) || !!jobContextJson);

  const profile = useMemo(
    () => getPracticeCompanyProfile(selectedCompany),
    [selectedCompany]
  );

  const practiceContextJson = useMemo(() => {
    const payload = {
      mode: "frontend-practice-builder",
      company: profile.name,
      companyKey: profile.key,
      role,
      experienceLevel,
      interviewStyle: profile.interviewStyle,
      behavioralFocus: profile.behavioralFocus,
      technicalFocus: profile.technicalFocus,
      dsaPatterns: profile.dsaPatterns,
      selectedFocusAreas: selectedFocus,
      notes:
        "Ask interview questions aligned to selected company style and target role. Keep follow-ups practical and role-relevant.",
    };

    return JSON.stringify(payload);
  }, [profile, role, experienceLevel, selectedFocus]);

  const toggleFocus = (area: string) => {
    setSelectedFocus((prev) => {
      if (prev.includes(area)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== area);
      }
      return [...prev, area];
    });
  };

  // Use initial context from Job Prep if provided, otherwise use the locally built one
  const effectiveContextJson = initialPracticeContextJson || practiceContextJson;

  if (started) {
    return (
      <Agent
        userName={userName}
        userId={userId}
        type="generate"
        jobContextJson={jobContextJson}
        practiceContextJson={effectiveContextJson}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background text-foreground py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="glass-card p-8 md:p-10 rounded-3xl border border-white/10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Practice Setup</h1>
          <p className="text-muted-foreground mt-3 text-base md:text-lg">
            Choose your target company and role. ZenAI will tailor the interview style and questions for that preparation path.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">Target Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value as PracticeCompanyKey)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-foreground"
              >
                {PRACTICE_COMPANY_PROFILES.map((company) => (
                  <option key={company.key} value={company.key}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/90">Role</label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Frontend Engineer"
                className="h-10"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground/90">Experience Level</label>
              <Input
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                placeholder="e.g. SDE-2"
                className="h-10"
              />
            </div>
          </div>

          <div className="mt-7">
            <p className="text-sm font-medium text-foreground/90 mb-3">Focus Areas</p>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((area) => {
                const active = selectedFocus.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleFocus(area)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      active
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-white/5 border-white/15 text-foreground/80 hover:bg-white/10"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Interview Style</p>
              <p className="text-foreground/90 text-sm">{profile.interviewStyle}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Likely DSA Patterns</p>
              <p className="text-foreground/90 text-sm">{profile.dsaPatterns.join(", ")}</p>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button onClick={() => setStarted(true)} className="px-8">
              Start Tailored Practice Interview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
