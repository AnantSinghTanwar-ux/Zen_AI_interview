"use client";

import { useState, useEffect } from "react";
import {
  FileText, Calendar, Loader2, Briefcase, Clock,
  CheckCircle2, XCircle, AlertCircle, Sparkles,
  ArrowRight, CalendarDays, Link2, MapPin
} from "lucide-react";
import Link from "next/link";
import type { ScheduledInterview } from "@/types/recruiter";

type ApplicationTab = "applications" | "schedule";

interface EnrichedApplication {
  id: string;
  jobId: string;
  name: string;
  email: string;
  status: string;
  appliedAt: string;
  jobTitle: string;
  companyName: string;
  jobStatus: string;
  screening: {
    overallScore: number;
    skillMatchPercent: number;
    recommendation: string;
    summary: string;
  } | null;
}

const statusPipeline = ["pending", "screening", "screened", "shortlisted", "invited", "in_progress", "completed"];

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", className: "text-gray-400", icon: Clock },
  screening: { label: "AI Screening", className: "text-violet-400", icon: Sparkles },
  screened: { label: "Screened", className: "text-blue-400", icon: CheckCircle2 },
  shortlisted: { label: "Shortlisted", className: "text-emerald-400", icon: CheckCircle2 },
  invited: { label: "Interview Invited", className: "text-indigo-400", icon: Calendar },
  in_progress: { label: "In Progress", className: "text-amber-400", icon: Clock },
  completed: { label: "Completed", className: "text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Not Selected", className: "text-red-400", icon: XCircle },
};

export default function CandidateDashboard() {
  const [tab, setTab] = useState<ApplicationTab>("applications");
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [schedules, setSchedules] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appsRes, schedRes, bulkRes] = await Promise.all([
          fetch("/api/v2/candidate/applications"),
          fetch("/api/v2/candidate/schedule"),
          fetch("/api/v2/candidate/bulk-interviews"),
        ]);

        let allSchedules: ScheduledInterview[] = [];

        if (appsRes.ok) {
          const data = await appsRes.json();
          setApplications(data.applications || []);
        }
        if (schedRes.ok) {
          const data = await schedRes.json();
          allSchedules = [...allSchedules, ...(data.schedules || [])];
        }
        if (bulkRes.ok) {
          const bulkData = await bulkRes.json();
          const mappedBulk = (bulkData.interviews || []).map((bi: any) => ({
            id: bi.id,
            candidateId: bi.id,
            jobId: bi.jobId,
            jobTitle: bi.jobTitle,
            scheduledAt: bi.createdAt || new Date().toISOString(),
            duration: 15,
            meetingLink: `/interview/join?token=${bi.interviewToken}`,
            status: bi.interviewCompletedAt ? "completed" : "scheduled",
            notes: "AI Bulk Screening Interview",
            createdAt: bi.createdAt || new Date().toISOString(),
            updatedAt: bi.createdAt || new Date().toISOString(),
          }));
          allSchedules = [...allSchedules, ...mappedBulk];
        }
        
        // Sort all schedules by scheduledAt descending (newest first)
        allSchedules.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
        
        setSchedules(allSchedules);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeApps = applications.filter((a) => a.status !== "rejected");
  const rejectedApps = applications.filter((a) => a.status === "rejected");
  const upcomingSchedules = schedules.filter(
    (s) => s.status === "scheduled" && new Date(s.scheduledAt).getTime() > Date.now()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          My Applications
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your job applications and upcoming interviews.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Applied" value={applications.length} icon={FileText} color="#FACC15" />
        <StatCard label="Active" value={activeApps.length} icon={CheckCircle2} color="#10B981" />
        <StatCard label="Interviews" value={upcomingSchedules.length} icon={Calendar} color="#8B5CF6" />
        <StatCard label="Not Selected" value={rejectedApps.length} icon={XCircle} color="#EF4444" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0.5">
        {([
          { key: "applications", label: "Applications", icon: FileText },
          { key: "schedule", label: "Interviews", icon: CalendarDays },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-xl border-b-2 ${
              tab === key
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "applications" && (
        <div className="space-y-6">
          {applications.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No applications yet"
              description="Browse open positions and apply with your resume."
              actionHref="/jobs"
              actionLabel="Browse Jobs"
            />
          ) : (
            <>
              {activeApps.length > 0 && (
                <div className="space-y-3">
                  {activeApps.map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                </div>
              )}
              {rejectedApps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Past Applications</h3>
                  {rejectedApps.map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No interviews scheduled"
              description="Interviews will appear here once recruiters schedule them."
            />
          ) : (
            schedules.map((s) => <ScheduleCard key={s.id} schedule={s} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof FileText; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/40 p-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}

function ApplicationCard({ application }: { application: EnrichedApplication }) {
  const status = statusConfig[application.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const currentIndex = statusPipeline.indexOf(application.status);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/40 p-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <Link href={`/jobs/${application.jobId}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block">
            {application.jobTitle}
          </Link>
          <p className="text-xs text-muted-foreground">{application.companyName}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${status.className}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </div>
      </div>

      {/* Progress Pipeline */}
      {application.status !== "rejected" && (
        <div className="flex items-center gap-1 mb-3">
          {statusPipeline.slice(0, 5).map((step, i) => {
            const isActive = i <= currentIndex;
            return (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className={`h-1 rounded-full flex-1 transition-all ${isActive ? "bg-primary" : "bg-white/5"}`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Screening summary */}
      {application.screening && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className={`font-semibold ${
            application.screening.overallScore >= 70 ? "text-emerald-400" :
            application.screening.overallScore >= 50 ? "text-yellow-400" : "text-red-400"
          }`}>
            Score: {application.screening.overallScore}
          </span>
          <span>Skill Match: {application.screening.skillMatchPercent}%</span>
          <span className="capitalize">{application.screening.recommendation}</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2">
        Applied {new Date(application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: ScheduledInterview }) {
  const date = new Date(schedule.scheduledAt);
  const isPast = date.getTime() < Date.now();

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isPast
        ? "border-white/[0.04] bg-white/[0.01] opacity-60"
        : "border-white/[0.06] bg-[#0A0A0A]/40 hover:border-white/10"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{schedule.jobTitle}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} • {schedule.duration}min
            </span>
          </div>
          {schedule.notes && (
            <p className="text-xs text-foreground/50 mt-2">{schedule.notes}</p>
          )}
        </div>
        {schedule.meetingLink && schedule.status !== "completed" && schedule.status !== "cancelled" && (
          <a
            href={schedule.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
            Join
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: typeof Briefcase;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="text-center py-16 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
      <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {actionHref && (
        <Link href={actionHref}>
          <button className="mt-4 text-xs font-medium text-primary hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
            {actionLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      )}
    </div>
  );
}
