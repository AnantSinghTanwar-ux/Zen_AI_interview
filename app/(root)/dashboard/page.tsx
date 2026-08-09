"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import {
  Mic,
  Code,
  Target,
  MessageSquare,
  BarChart3,
  Sparkles,
  CreditCard,
  GraduationCap,
  ArrowRight,
  Loader2,
  TrendingUp,
  History,
  CheckCircle2,
} from "lucide-react";

interface UserCredits {
  interviews: number;
  dsaSessions: number;
}

interface CollegePlan {
  collegeName: string;
  remaining: number;
  total: number;
  active: boolean;
}

interface CreditsResponse {
  credits: UserCredits;
  collegePlan: CollegePlan | null;
  email: string;
}

interface BulkInterview {
  id: string;
  bulkJobId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  interviewToken: string;
  interviewCompletedAt?: string;
  interviewScore?: number;
  createdAt: string;
}


export default function DashboardPage() {
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [bulkInterviews, setBulkInterviews] = useState<BulkInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [suggestedProduct, setSuggestedProduct] = useState<
    "interview_10" | "interview_30" | "dsa_starter" | "dsa_practice" | "dsa_pro"
  >("interview_30");
  const [premiumMessage, setPremiumMessage] = useState<string>("");
  const [vapiHealth, setVapiHealth] = useState<number | null>(null);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/premium/credits");
        if (res.status === 401) {
          window.location.href = '/sign-in?clear_session=true';
          return;
        }
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch credits:", error);
      }
    };
    
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/vapi/health");
        if (res.ok) {
          const data = await res.json();
          setVapiHealth(data.healthScore);
        }
      } catch (error) {
        // Silently fail health check
      }
    };

    const fetchBulkInterviews = async () => {
      try {
        const res = await fetch("/api/v2/candidate/bulk-interviews");
        if (res.ok) {
          const data = await res.json();
          setBulkInterviews(data.interviews || []);
        }
      } catch (error) {
        console.error("Failed to fetch bulk interviews:", error);
      }
    };
    
    Promise.all([fetchCredits(), fetchHealth(), fetchBulkInterviews()]).finally(() => {
      setLoading(false);
    });
  }, []);

  const credits = data?.credits || { interviews: 0, dsaSessions: 0 };
  const collegePlan = data?.collegePlan;
  const hasInterviewAccess = credits.interviews > 0 || (collegePlan?.active && (collegePlan.remaining ?? 0) > 0);
  const hasDSAAccess = credits.dsaSessions > 0;

  const openPaymentPopup = (
    product: "interview_10" | "interview_30" | "dsa_starter" | "dsa_practice" | "dsa_pro",
    message: string
  ) => {
    let finalMessage = message;
    if (product === "interview_30" && vapiHealth !== null && vapiHealth <= 1) {
      finalMessage = "⚠️ WARNING: The Vapi AI service is currently experiencing instability (Health is low). Voice interviews might fail. You can still purchase, but we recommend waiting.";
    }
    setSuggestedProduct(product);
    setPremiumMessage(finalMessage);
    setShowPaymentPopup(true);
  };

  // Features available in the dashboard
  const features = [
    {
      id: "interview",
      title: "AI Voice Interview",
      description: "10 or 30-minute mock interview with AI voice interaction, follow-up questions, and detailed scorecard",
      icon: <Mic className="w-6 h-6" />,
      color: "#FACC15",
      href: "/interview",
      hasAccess: hasInterviewAccess,
      credits: credits.interviews + (collegePlan?.active ? (collegePlan.remaining ?? 0) : 0),
      creditLabel: "sessions",
      product: "interview_30",
      payMessage: "Purchase an Interview session (₹149 for 10 min or ₹399 for 30 min) to access AI Voice Interviews.",
    },
    {
      id: "dsa",
      title: "DSA Practice",
      description: "Company-focused DSA problems with AI interviewer that guides you through solutions in real-time",
      icon: <Code className="w-6 h-6" />,
      color: "#10B981",
      href: "/dsa-interview",
      hasAccess: hasDSAAccess,
      credits: credits.dsaSessions,
      creditLabel: "sessions",
      product: "dsa_practice",
      payMessage: "Purchase a DSA Practice session (starting ₹19) to access DSA Practice.",
    },
    {
      id: "job-prep",
      title: "Job Prep",
      description: "Tailored interview preparation — select company, role, experience level, and focus areas",
      icon: <Target className="w-6 h-6" />,
      color: "#8B5CF6",
      href: "/job-prep",
      hasAccess: true, // Always accessible (it leads to interview/dsa which check credits)
      credits: null,
      creditLabel: null,
      product: null,
      payMessage: null,
    },
    {
      id: "feedback",
      title: "Session Feedback",
      description: "View detailed scorecards, performance analytics, and personalized improvement plans",
      icon: <MessageSquare className="w-6 h-6" />,
      color: "#3B82F6",
      href: "/feedback",
      hasAccess: true, // Always accessible
      credits: null,
      creditLabel: null,
      product: null,
      payMessage: null,
    },
    {
      id: "call-data",
      title: "Interview History",
      description: "Browse past interview recordings, transcripts, and detailed evaluation reports",
      icon: <History className="w-6 h-6" />,
      color: "#F97316",
      href: "/call-data",
      hasAccess: true, // Always accessible
      credits: null,
      creditLabel: null,
      product: null,
      payMessage: null,
    },
    {
      id: "progress",
      title: "Progress & Analytics",
      description: "Track your improvement over time with performance trends and skill breakdowns",
      icon: <TrendingUp className="w-6 h-6" />,
      color: "#EC4899",
      href: "/progress",
      hasAccess: true, // Always accessible
      credits: null,
      creditLabel: null,
      product: null,
      payMessage: null,
    },
  ];

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6 pt-28">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your practice sessions and track your progress
              </p>
            </div>
            <Link href="/#pricing">
              <Button className="bg-primary hover:bg-primary/90 text-black rounded-full px-6 font-semibold">
                <CreditCard className="w-4 h-4 mr-2" />
                Buy Credits
              </Button>
            </Link>
          </div>

          {/* Credits Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Interview Credits */}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FACC15]/15 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#FACC15]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Interview Credits</p>
                  <p className="text-2xl font-bold text-foreground">{credits.interviews}</p>
                </div>
              </div>
              {credits.interviews === 0 && (
                <button
                  onClick={() => openPaymentPopup("interview_30", "Purchase Interview sessions to start practicing.")}
                  className="text-xs text-[#FACC15] hover:underline cursor-pointer"
                >
                  + Buy interviews (₹149/₹399 per session)
                </button>
              )}
            </div>

            {/* DSA Credits */}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 flex items-center justify-center">
                  <Code className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">DSA Credits</p>
                  <p className="text-2xl font-bold text-foreground">{credits.dsaSessions}</p>
                </div>
              </div>
              {credits.dsaSessions === 0 && (
                <button
                  onClick={() => openPaymentPopup("dsa_practice", "Purchase DSA Practice sessions to start solving problems.")}
                  className="text-xs text-[#10B981] hover:underline cursor-pointer"
                >
                  + Buy DSA sessions (starting ₹19/session)
                </button>
              )}
            </div>

            {/* College Plan */}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">College Plan</p>
                  {collegePlan?.active ? (
                    <p className="text-2xl font-bold text-foreground">{collegePlan.remaining}<span className="text-sm font-normal text-muted-foreground">/{collegePlan.total}</span></p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active plan</p>
                  )}
                </div>
              </div>
              {collegePlan?.active && (
                <p className="text-xs text-[#8B5CF6]">{collegePlan.collegeName}</p>
              )}
            </div>
          </div>

          {/* Scheduled Bulk Interviews */}
          {bulkInterviews.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#8B5CF6]" />
                Scheduled Job Interviews
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bulkInterviews.map((interview) => (
                  <div key={interview.id} className="group relative glass-card p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:translate-y-[-2px]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6]">
                        <Mic className="w-6 h-6" />
                      </div>
                      {interview.interviewCompletedAt && (
                        <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
                          Completed
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-1">
                      {interview.jobTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {interview.companyName}
                    </p>
                    
                    {!interview.interviewCompletedAt ? (
                      <Link href={`/interview/join?token=${interview.interviewToken}`}>
                        <Button className="w-full rounded-xl bg-primary text-black hover:bg-primary/90 transition-all font-semibold">
                          Start Interview
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    ) : (
                      <Button disabled variant="outline" className="w-full rounded-xl border-white/15 bg-white/[0.05]">
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
                        Scored & Submitted
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Cards */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature) => {
                const canAccess = feature.hasAccess;

                return (
                  <div
                    key={feature.id}
                    className={`group relative glass-card p-6 rounded-2xl border transition-all duration-300 ${
                      canAccess
                        ? "border-white/10 hover:border-white/20 cursor-pointer hover:translate-y-[-2px]"
                        : "border-white/5 opacity-60"
                    }`}
                  >
                    {/* Credit badge */}
                    {feature.credits !== null && (
                      <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        canAccess
                          ? "bg-green-500/15 text-green-400 border border-green-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}>
                        {feature.credits} {feature.creditLabel}
                      </div>
                    )}

                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
                    >
                      {feature.icon}
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {feature.description}
                    </p>

                    {canAccess ? (
                      <Link href={feature.href}>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-white/15 hover:bg-white/[0.08] group-hover:border-white/20 transition-all"
                        >
                          Open
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        onClick={() => openPaymentPopup(feature.product!, feature.payMessage!)}
                        className="w-full rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-all"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Purchase to Unlock
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <PremiumAccessPopup
        open={showPaymentPopup}
        message={premiumMessage}
        suggestedProduct={suggestedProduct}
        onClose={() => setShowPaymentPopup(false)}
        onActivated={() => {
          setShowPaymentPopup(false);
          // Refresh credits after payment
          fetch("/api/premium/credits")
            .then((res) => res.json())
            .then((json) => setData(json))
            .catch(console.error);
        }}
      />
    </PageLayout>
  );
}
