"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Zap,
  SlidersHorizontal,
  Users,
  Sparkles,
  RotateCcw,
  Download,
  ArrowLeft,
} from "lucide-react";
import type {
  ScreeningStage,
  ScreeningProgress,
  ScreeningProgressEvent,
  ScreenedCandidateRow,
} from "@/types/bulk-screening";
import BulkResumeUploader from "./BulkResumeUploader";
import ScreeningProgressBar from "./ScreeningProgressBar";
import CandidateVerificationTable from "./CandidateVerificationTable";

interface BulkScreeningDashboardProps {
  jobId: string;
  jobTitle?: string;
}

type DashboardPhase = "upload" | "processing" | "results";

const DEFAULT_PROGRESS: ScreeningProgress = {
  extracted: 0,
  extractionFailed: 0,
  embedded: 0,
  semanticFiltered: 0,
  llmScored: 0,
  shortlisted: 0,
  emailed: 0,
  emailFailed: 0,
};

export default function BulkScreeningDashboard({
  jobId,
  jobTitle = "Position",
}: BulkScreeningDashboardProps) {
  // Phase management
  const [phase, setPhase] = useState<DashboardPhase>("upload");
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);

  // Upload config
  const [topN, setTopN] = useState(200);
  const [totalResumes, setTotalResumes] = useState(0);

  // Progress tracking
  const [stage, setStage] = useState<ScreeningStage>("uploading");
  const [progress, setProgress] = useState<ScreeningProgress>(DEFAULT_PROGRESS);
  const [progressMessage, setProgressMessage] = useState("");
  const [eta, setEta] = useState(-1);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Results
  const [candidates, setCandidates] = useState<ScreenedCandidateRow[]>([]);
  const [resultStats, setResultStats] = useState<{
    totalCandidates: number;
    shortlistedCount: number;
    emailedCount: number;
    averageScore: number;
  } | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsTotalPages, setResultsTotalPages] = useState(1);
  const [resultsTotalCandidates, setResultsTotalCandidates] = useState(0);
  const [sortBy, setSortBy] = useState("llmScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);

  // SSE connection for real-time progress
  const connectSSE = useCallback((jobId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `/api/v2/screening/progress?jobId=${jobId}`
    );

    es.onmessage = (event) => {
      try {
        const data: ScreeningProgressEvent = JSON.parse(event.data);

        setStage(data.stage);
        setProgress(data.progress);
        setProgressMessage(data.message || "");
        setTotalResumes(data.totalResumes);
        setEta(data.estimatedSecondsRemaining ?? -1);

        if (data.stage === "completed") {
          setPhase("results");
          es.close();
          eventSourceRef.current = null;
          toast.success("Screening pipeline completed!");
        }

        if (data.stage === "failed") {
          es.close();
          eventSourceRef.current = null;
          toast.error("Screening pipeline failed. Check logs for details.");
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects, but log for debugging
      console.warn("[SSE] Connection error, will retry...");
    };

    eventSourceRef.current = es;
  }, []);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Fetch results when in results phase
  const fetchResults = useCallback(async () => {
    if (!bulkJobId) return;

    setResultsLoading(true);
    try {
      const params = new URLSearchParams({
        bulkJobId,
        page: String(resultsPage),
        pageSize: "50",
        sortBy,
        sortOrder,
        ...(searchQuery ? { search: searchQuery } : {}),
      });

      const res = await fetch(`/api/v2/screening/results?${params}`);
      if (!res.ok) throw new Error("Failed to fetch results");

      const data = await res.json();
      setCandidates(data.candidates || []);
      setResultsTotalPages(data.pagination?.totalPages || 1);
      setResultsTotalCandidates(data.pagination?.totalCandidates || 0);
      setResultStats(data.stats || null);
    } catch (err) {
      toast.error("Failed to load screening results");
    } finally {
      setResultsLoading(false);
    }
  }, [bulkJobId, resultsPage, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    if (phase === "results") {
      fetchResults();
    }
  }, [phase, fetchResults]);

  // Handle upload completion
  const handleUploadComplete = useCallback(
    (newBulkJobId: string) => {
      setBulkJobId(newBulkJobId);
      setPhase("processing");
      setStage("extracting");
      setProgress(DEFAULT_PROGRESS);
      connectSSE(newBulkJobId);
    },
    [connectSSE]
  );

  // Reset to upload phase
  const handleReset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setPhase("upload");
    setBulkJobId(null);
    setStage("uploading");
    setProgress(DEFAULT_PROGRESS);
    setCandidates([]);
    setResultStats(null);
    setResultsPage(1);
    setSearchQuery("");
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {phase !== "upload" && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Bulk Screening Engine
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {phase === "upload"
              ? `Upload resumes to screen for ${jobTitle}`
              : phase === "processing"
                ? "Pipeline in progress..."
                : `Results for ${jobTitle}`}
          </p>
        </div>

        {phase === "results" && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl hover:bg-white/[0.04] border border-white/[0.06] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            New Screening
          </button>
        )}
      </div>

      {/* ── Upload Phase ── */}
      {phase === "upload" && (
        <div className="space-y-8">
          {/* Top N Slider */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Cutoff Threshold
              </h3>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex-1 space-y-3">
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                  style={{
                    background: `linear-gradient(to right, rgb(99, 102, 241) ${(topN / 1000) * 100}%, rgba(255,255,255,0.06) ${(topN / 1000) * 100}%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10</span>
                  <span>250</span>
                  <span>500</span>
                  <span>750</span>
                  <span>1000</span>
                </div>
              </div>

              {/* Numeric display */}
              <div className="text-center shrink-0">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={topN}
                    onChange={(e) =>
                      setTopN(
                        Math.max(1, Math.min(5000, Number(e.target.value) || 200))
                      )
                    }
                    className="w-20 text-center text-2xl font-bold text-primary bg-primary/5 border border-primary/20 rounded-xl py-2 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  Top N
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>
                AI will screen all resumes and select the top{" "}
                <strong className="text-foreground">{topN}</strong> candidates
                based on job fit, skills, and experience alignment.
              </span>
            </div>
          </div>

          {/* Resume Uploader */}
          <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Upload Resumes
              </h3>
            </div>
            <BulkResumeUploader
              jobId={jobId}
              topN={topN}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
      )}

      {/* ── Processing Phase ── */}
      {phase === "processing" && (
        <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-6">
          <ScreeningProgressBar
            stage={stage}
            progress={progress}
            totalResumes={totalResumes}
            topN={topN}
            message={progressMessage}
            estimatedSecondsRemaining={eta}
          />
        </div>
      )}

      {/* ── Results Phase ── */}
      {phase === "results" && (
        <CandidateVerificationTable
          candidates={candidates}
          totalCandidates={resultsTotalCandidates}
          page={resultsPage}
          pageSize={50}
          totalPages={resultsTotalPages}
          onPageChange={setResultsPage}
          onSort={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
            setResultsPage(1);
          }}
          onSearch={(query) => {
            setSearchQuery(query);
            setResultsPage(1);
          }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          searchQuery={searchQuery}
          loading={resultsLoading}
          stats={resultStats || undefined}
        />
      )}
    </div>
  );
}
