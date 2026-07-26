"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Briefcase, MapPin, Code, Clock, Users, Loader2,
  CheckCircle2, Upload, FileText, Sparkles, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface JobDetail {
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

export default function JobDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/v2/jobs/${jobId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Job not found");
          return;
        }
        const data = await res.json();
        setJob(data.job);
      } catch {
        setError("Failed to load job details");
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-32">
        <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <p className="text-lg text-muted-foreground">{error || "Job not found"}</p>
        <Link href="/jobs">
          <Button variant="outline" className="mt-4 rounded-xl border-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  const deadlineDate = job.deadline ? new Date(job.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate.getTime() < Date.now() : false;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/jobs"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </Link>

      {/* Job Header */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/40 p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Briefcase className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <p className="text-muted-foreground mt-1">{job.companyName}</p>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5 text-muted-foreground">
            <Code className="w-3.5 h-3.5" />
            {levelLabels[job.experienceLevel] || job.experienceLevel}
          </span>
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5 text-muted-foreground capitalize">
            <Sparkles className="w-3.5 h-3.5" />
            {job.type}
          </span>
          {job.location && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/5 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            {job.applicantCount} applicant{job.applicantCount !== 1 ? "s" : ""}
          </span>
          {deadlineDate && (
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              isExpired
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              <Calendar className="w-3.5 h-3.5" />
              {isExpired ? "Expired" : `Deadline: ${deadlineDate.toLocaleDateString()}`}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="prose prose-invert max-w-none mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
          <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        </div>

        {/* Required Skills */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {job.requiredSkills.map((skill) => (
              <span
                key={skill}
                className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Salary */}
        {job.salaryRange && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-1">Salary Range</h3>
            <p className="text-sm text-muted-foreground">
              ₹{job.salaryRange.min.toLocaleString()} — ₹{job.salaryRange.max.toLocaleString()} / year
            </p>
          </div>
        )}

        {/* Apply Button */}
        {applied ? (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-emerald-400 font-medium">
              Application submitted! Your resume is being screened by our AI.
            </p>
          </div>
        ) : isExpired ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">This job posting has expired and is no longer accepting applications.</p>
          </div>
        ) : !showApplyForm ? (
          <Button
            onClick={() => setShowApplyForm(true)}
            className="w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold px-8 py-3"
          >
            <Upload className="w-4 h-4 mr-2" />
            Apply Now
          </Button>
        ) : (
          <ApplicationForm
            jobId={jobId}
            onSuccess={() => {
              setApplied(true);
              setShowApplyForm(false);
            }}
            onCancel={() => setShowApplyForm(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Inline Application Form ────────────────────────────────────────────────

function ApplicationForm({
  jobId,
  onSuccess,
  onCancel,
}: {
  jobId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [resumeText, setResumeText] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractTextFromPDF(file);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword"
      ) {
        text = await extractTextFromDocx(file);
      } else if (file.type === "text/plain") {
        text = await file.text();
      } else {
        throw new Error("Unsupported format. Please upload PDF, DOCX, or TXT.");
      }

      if (text.trim().length < 50) {
        throw new Error("Could not extract enough text from the resume.");
      }

      setResumeText(text.slice(0, 12_000));
      setFileName(file.name);
      toast.success("Resume processed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process resume");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resumeText) {
      toast.error("Please upload your resume first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v2/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, coverLetter: coverLetter.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Please sign in to apply");
          window.location.href = `/sign-in?redirect=${encodeURIComponent(`/jobs/${jobId}`)}`;
          return;
        }
        throw new Error(data.error || "Failed to submit application");
      }

      toast.success("Application submitted!");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mt-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Apply for this position
      </h3>

      {/* Resume Upload */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Resume <span className="text-red-400">*</span>
        </label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-4 rounded-xl border border-dashed border-white/15 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all bg-white/[0.02] flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Processing...
            </>
          ) : fileName ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {fileName}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Resume (PDF, DOCX, or TXT)
            </>
          )}
        </button>
      </div>

      {/* Cover Letter */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          Cover Letter <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          placeholder="Why are you interested in this role?"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={4}
          maxLength={5000}
          className="w-full px-3 py-2 text-sm rounded-xl resize-none"
        />
      </div>

      {/* AI notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15">
        <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-300/80">
          Your resume will be analyzed by our AI screening system to match your skills and experience with the job requirements.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 rounded-xl border-white/10"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !resumeText}
          className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </form>
  );
}
