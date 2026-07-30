"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Zap,
  SlidersHorizontal,
  Users,
  Sparkles,
  RotateCcw,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import type {
  ScreenedCandidateRow,
} from "@/types/bulk-screening";
import BulkResumeUploader from "./BulkResumeUploader";
import CandidateVerificationTable from "./CandidateVerificationTable";

interface BulkScreeningDashboardProps {
  jobId: string;
  jobTitle?: string;
}

type DashboardPhase = "upload" | "processing" | "results";

export default function BulkScreeningDashboard({
  jobId,
  jobTitle = "Position",
}: BulkScreeningDashboardProps) {
  // Phase management
  const [phase, setPhase] = useState<DashboardPhase>("upload");
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);

  // Upload config
  const [topN, setTopN] = useState(200);

  // Processing status
  const [processingMessage, setProcessingMessage] = useState("Starting screening pipeline...");

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

  // Fetch results from Firestore
  const fetchResults = useCallback(async (bjId: string, page = 1, sort = "llmScore", order = "desc", search = "") => {
    setResultsLoading(true);
    try {
      const params = new URLSearchParams({
        bulkJobId: bjId,
        page: String(page),
        pageSize: "50",
        sortBy: sort,
        sortOrder: order,
        ...(search ? { search } : {}),
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
  }, []);

  // Handle upload completion — the backend now does everything inline
  const handleUploadComplete = useCallback(
    async (newBulkJobId: string) => {
      setBulkJobId(newBulkJobId);
      setPhase("results");
      toast.success("Screening pipeline completed!");
      // Fetch the results
      await fetchResults(newBulkJobId);
    },
    [fetchResults]
  );

  // When results phase params change, re-fetch
  const handlePageChange = useCallback((page: number) => {
    setResultsPage(page);
    if (bulkJobId) fetchResults(bulkJobId, page, sortBy, sortOrder, searchQuery);
  }, [bulkJobId, sortBy, sortOrder, searchQuery, fetchResults]);

  const handleSort = useCallback((field: string, order: "asc" | "desc") => {
    setSortBy(field);
    setSortOrder(order);
    setResultsPage(1);
    if (bulkJobId) fetchResults(bulkJobId, 1, field, order, searchQuery);
  }, [bulkJobId, searchQuery, fetchResults]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setResultsPage(1);
    if (bulkJobId) fetchResults(bulkJobId, 1, sortBy, sortOrder, query);
  }, [bulkJobId, sortBy, sortOrder, fetchResults]);

  // Reset to upload phase
  const handleReset = useCallback(() => {
    setPhase("upload");
    setBulkJobId(null);
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
        <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-10">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-2">AI Screening in Progress</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {processingMessage}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Extracting text → Scoring with AI → Shortlisting → Sending emails
              </p>
            </div>
          </div>
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
          onPageChange={handlePageChange}
          onSort={handleSort}
          onSearch={handleSearch}
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
