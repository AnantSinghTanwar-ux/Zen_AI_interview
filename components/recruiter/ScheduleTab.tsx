"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Clock, Loader2, Link2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { ScheduledInterview } from "@/types/recruiter";

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export default function ScheduleTab() {
  const [schedules, setSchedules] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/recruiter/schedule");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error("Error fetching schedules:", err);
      toast.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCancel = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    try {
      const res = await fetch(`/api/v2/recruiter/schedule/${scheduleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel");
      toast.success("Interview cancelled");
      fetchSchedules();
    } catch {
      toast.error("Failed to cancel interview");
    }
  };

  const handleComplete = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/v2/recruiter/schedule/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Interview marked as completed");
      fetchSchedules();
    } catch {
      toast.error("Failed to update schedule");
    }
  };

  const now = Date.now();
  const upcoming = schedules.filter(
    (s) => s.status === "scheduled" && new Date(s.scheduledAt).getTime() >= now
  );
  const past = schedules.filter(
    (s) => s.status !== "scheduled" || new Date(s.scheduledAt).getTime() < now
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          Interview Schedule
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {upcoming.length} upcoming • {past.length} past/completed
        </p>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No interviews scheduled yet</p>
          <p className="text-xs text-muted-foreground mt-1">Schedule interviews from the Jobs tab by viewing applicants</p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-emerald-400">Upcoming</h3>
              {upcoming.map((s) => (
                <ScheduleCard key={s.id} schedule={s} onCancel={handleCancel} onComplete={handleComplete} />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Past</h3>
              {past.map((s) => (
                <ScheduleCard key={s.id} schedule={s} onCancel={handleCancel} onComplete={handleComplete} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScheduleCard({
  schedule,
  onCancel,
  onComplete,
}: {
  schedule: ScheduledInterview;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const status = statusConfig[schedule.status] || statusConfig.scheduled;
  const date = new Date(schedule.scheduledAt);
  const isUpcoming = schedule.status === "scheduled" && date.getTime() >= Date.now();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/40 p-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{schedule.candidateName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{schedule.jobTitle}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} • {schedule.duration}min
            </span>
            {schedule.meetingLink && schedule.interviewType !== "ai" && (
              <a
                href={schedule.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Link2 className="w-3.5 h-3.5" />
                Join
              </a>
            )}
          </div>

          {schedule.notes && (
            <p className="text-xs text-foreground/60 mt-2 border-l-2 border-white/10 pl-2">{schedule.notes}</p>
          )}
        </div>

        {isUpcoming && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onComplete(schedule.id)}
              title="Mark as completed"
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onCancel(schedule.id)}
              title="Cancel interview"
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
