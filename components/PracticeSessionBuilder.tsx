
"use client";

import { useMemo, useState } from "react";
import Agent from "@/components/Agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import {
  PRACTICE_COMPANY_PROFILES,
  PracticeCompanyKey,
  getPracticeCompanyProfile,
} from "@/constants/practice";
import { FaGoogle, FaApple, FaMicrosoft, FaAmazon, FaMeta } from "react-icons/fa6";
import { Briefcase, Pickaxe, Award, Target, Brain, Code, CheckCircle2 } from "lucide-react";

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

const companyIcons: Record<string, any> = {
  microsoft: <FaMicrosoft className="w-8 h-8 mb-2" />,
  google: <FaGoogle className="w-8 h-8 mb-2" />,
  meta: <FaMeta className="w-8 h-8 mb-2" />,
  amazon: <FaAmazon className="w-8 h-8 mb-2" />,
  apple: <FaApple className="w-8 h-8 mb-2" />,
  stripe: <span className="font-bold text-xl tracking-tighter mb-2">stripe</span>,
};

const experienceLevels = [
  { id: "SDE-1 / Early Career", icon: <Pickaxe className="w-5 h-5" />, label: "Early Career (L3/SDE-1)" },
  { id: "SDE-2 / Mid Level", icon: <Briefcase className="w-5 h-5" />, label: "Mid Level (L4/SDE-2)" },
  { id: "Senior / Staff", icon: <Award className="w-5 h-5" />, label: "Senior / Staff (L5+)" },
];

export default function PracticeSessionBuilder({
  userName,
  userId,
  jobContextJson,
  initialPracticeContextJson,
  autoStart,
}: PracticeSessionBuilderProps) {
  const [step, setStep] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState<PracticeCompanyKey>("microsoft");
  const [role, setRole] = useState("Software Engineer");
  const [experienceLevel, setExperienceLevel] = useState("SDE-1 / Early Career");
  const [selectedFocus, setSelectedFocus] = useState<string[]>(["Core CS Fundamentals", "Problem Solving"]);
  const [started, setStarted] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const profile = useMemo(() => getPracticeCompanyProfile(selectedCompany), [selectedCompany]);

  const practiceContextJson = useMemo(() => {
    return JSON.stringify({
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
      notes: "High-tier mock interview aligned to exact specifications.",
    });
  }, [profile, role, experienceLevel, selectedFocus]);

  const effectiveContextJson = initialPracticeContextJson || practiceContextJson;

  const toggleFocus = (area: string) => {
    setSelectedFocus((prev) => {
      if (prev.includes(area)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== area);
      }
      return [...prev, area];
    });
  };

  const matchStrength = useMemo(() => {
    let score = 50;
    if (selectedFocus.length >= 3) score += 20;
    else if (selectedFocus.length >= 2) score += 10;
    if (role.trim().length > 3) score += 15;
    if (experienceLevel) score += 15;
    return Math.min(100, score);
  }, [selectedFocus, role, experienceLevel]);

  const checkAndStartSession = async () => {
    setIsCheckingAccess(true);
    try {
      const res = await fetch("/api/premium/vapi-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "interview",
          quotaKind: "interview",
          action: "check",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (res.status === 402 || data.allowed === false) {
        setShowPaymentPopup(true);
        return;
      }

      if (!res.ok) {
        console.error("Access check failed:", data);
        return;
      }

      // Access granted — start the session
      setStarted(true);
    } catch (error) {
      console.error("Failed to check access:", error);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  // Add auto-start effect
  useEffect(() => {
    if ((autoStart === true && !!initialPracticeContextJson) || !!jobContextJson) {
      checkAndStartSession();
    }
  }, []);

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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 opacity-80">
           <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? "bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.3)]" : "bg-white/10"}`}>1</div>
              <div className={`w-12 h-1 ${step >= 2 ? "bg-lime-400" : "bg-white/10"}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? "bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.3)]" : "bg-white/10"}`}>2</div>
              <div className={`w-12 h-1 ${step >= 3 ? "bg-lime-400" : "bg-white/10"}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? "bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.3)]" : "bg-white/10"}`}>3</div>
           </div>
           
           <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
              <Brain className="w-4 h-4 text-lime-400" />
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">AI Alignment: {matchStrength}%</span>
           </div>
        </div>

        <div className="glass-card p-10 mt-6 relative overflow-visible">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                  <h1 className="text-4xl font-bold tracking-tight">Select Target Paradigm</h1>
                  <p className="text-muted-foreground mt-2">Choose the architectural bar you are interviewing for.</p>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {PRACTICE_COMPANY_PROFILES.map((company) => {
                   const isActive = selectedCompany === company.key;
                   const Icon = companyIcons[company.key] || <Target className="w-8 h-8 mb-2" />;
                   return (
                     <button
                       key={company.key}
                       onClick={() => setSelectedCompany(company.key as PracticeCompanyKey)}
                       className={`flex flex-col items-center justify-center p-6 border rounded-2xl transition-all duration-300 ${
                         isActive 
                           ? "border-lime-400 bg-lime-400/5 text-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.15)]" 
                           : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/70"
                       }`}
                     >
                       {Icon}
                       <span className="font-semibold text-sm tracking-wide">{company.name}</span>
                     </button>
                   );
                 })}
               </div>

               <div className="pt-4 space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#888]">Target Role Designation</label>
                  <Input 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)} 
                    className="h-14 text-lg bg-black/40 border-white/10" 
                    placeholder="e.g. Frontend Infrastructure Engineer"
                  />
               </div>

               <div className="flex justify-end pt-6 border-t border-white/10">
                 <Button onClick={() => setStep(2)} className="btn-primary w-full md:w-auto h-12">Configure Parameters</Button>
               </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                  <h1 className="text-4xl font-bold tracking-tight">Experience & Constraints</h1>
                  <p className="text-muted-foreground mt-2">Tune the difficulty and technical bar for the session.</p>
               </div>

               <div className="space-y-3">
                 <label className="text-xs font-semibold uppercase tracking-widest text-[#888]">Experience Tier</label>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {experienceLevels.map((lvl) => {
                     const isActive = experienceLevel === lvl.id;
                     return (
                        <button
                          key={lvl.id}
                          onClick={() => setExperienceLevel(lvl.id)}
                          className={`flex items-center gap-3 p-4 border rounded-2xl transition-all duration-300 w-full text-left ${
                            isActive 
                              ? "border-lime-400 bg-lime-400/5 text-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.1)]" 
                              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/70"
                          }`}
                        >
                          {lvl.icon}
                          <span className="font-semibold text-sm">{lvl.label}</span>
                        </button>
                     )
                   })}
                 </div>
               </div>

               <div className="pt-4 space-y-4">
                 <label className="text-xs font-semibold uppercase tracking-widest text-[#888]">Focus Heuristics</label>
                 <div className="flex flex-wrap gap-3">
                   {focusAreas.map((area) => {
                     const isActive = selectedFocus.includes(area);
                     return (
                        <button
                          key={area}
                          onClick={() => toggleFocus(area)}
                          className={`px-5 py-2.5 rounded-full text-sm border font-medium transition-all duration-300 ${
                            isActive 
                              ? "border-lime-400 bg-lime-400/10 text-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)]" 
                              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {area}
                        </button>
                     )
                   })}
                 </div>
               </div>

               <div className="flex justify-between pt-6 border-t border-white/10 mt-8">
                 <Button variant="ghost" onClick={() => setStep(1)} className="text-[#888] hover:text-white">Back</Button>
                 <Button onClick={() => setStep(3)} className="btn-primary h-12">Review Profile</Button>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="text-center">
                  <CheckCircle2 className="w-16 h-16 text-lime-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]" />
                  <h1 className="text-4xl font-bold tracking-tight">AI Interviewer Provisioned</h1>
                  <p className="text-muted-foreground mt-2">The context window has been optimally seeded.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
                 <div className="bg-white/[0.02] border border-white/10 backdrop-blur-md rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-2 flex items-center gap-2"><Code className="w-3 h-3" /> Technical Style</p>
                    <p className="text-white/90 text-sm leading-relaxed">{profile.interviewStyle}</p>
                 </div>
                 <div className="bg-white/[0.02] border border-white/10 backdrop-blur-md rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-2 flex items-center gap-2"><Target className="w-3 h-3" /> Core Patterns</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                       {profile.dsaPatterns.map((p) => (
                         <span key={p} className="px-2 py-1 bg-black/40 border border-white/10 rounded-md text-xs text-white/80">{p}</span>
                       ))}
                    </div>
                 </div>
               </div>

               <div className="flex justify-between pt-6 border-t border-white/10">
                 <Button variant="ghost" onClick={() => setStep(2)} className="text-[#888] hover:text-white">Modify Parameters</Button>
                 <Button
                   onClick={checkAndStartSession}
                   disabled={isCheckingAccess}
                   className="btn-get-started h-14"
                 >
                   {isCheckingAccess ? "Verifying access..." : "Initialize Session"}
                 </Button>
               </div>
            </div>
          )}
        </div>
      </div>

      <PremiumAccessPopup
        open={showPaymentPopup}
        message="Purchase an interview session to start your AI-powered mock interview."
        suggestedProduct="single_interview"
        onClose={() => setShowPaymentPopup(false)}
        onActivated={() => {
          setShowPaymentPopup(false);
          setStarted(true);
        }}
      />
    </div>
  );
}

