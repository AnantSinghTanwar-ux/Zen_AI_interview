"use client";

import { useState } from "react";
import { Calendar, Clock, Link2, MessageSquare, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScheduleInterviewModalProps {
  applicantId: string;
  applicantName: string;
  jobId: string;
  jobTitle: string;
  onClose: () => void;
  onScheduled: () => void;
}

export default function ScheduleInterviewModal({
  applicantId,
  applicantName,
  jobId,
  jobTitle,
  onClose,
  onScheduled,
}: ScheduleInterviewModalProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate.getTime() < Date.now()) {
      toast.error("Interview must be scheduled in the future");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/v2/recruiter/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          jobId,
          scheduledAt: scheduledDate.toISOString(),
          duration,
          meetingLink: meetingLink.trim(),
          notes: notes.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to schedule interview");
      }

      toast.success(`Interview scheduled with ${applicantName}`);
      onScheduled();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule interview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Schedule Interview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {applicantName} — {jobTitle}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Date/Time */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-xl"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-xl"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </div>

          {/* Meeting Link */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-primary" />
              Meeting Link <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://meet.google.com/..."
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Notes <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              placeholder="Interview instructions or topics to cover..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 text-sm rounded-xl resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl border-white/10 hover:bg-white/[0.05]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Interview"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
