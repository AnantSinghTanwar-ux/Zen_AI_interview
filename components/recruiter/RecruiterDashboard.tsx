"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  BarChart3, Users, CheckCircle2, Clock, TrendingUp,
  Trophy, Loader2, Building2, Globe,
  ThumbsUp, ThumbsDown,
  Award, ExternalLink, Search, Eye, Download, RefreshCw,
  UserCheck, FileSpreadsheet, SlidersHorizontal, Sparkles,
  Briefcase, CalendarDays
} from "lucide-react";
import type { ExternalApplication, ApplicationScore, LeaderboardEntry } from "@/types/external-application";
import JobManagementDashboard from "./JobManagementDashboard";
import ScheduleTab from "./ScheduleTab";

type Tab = "overview" | "applications" | "leaderboard" | "hiring" | "talent-pool" | "jobs" | "schedule";

const TEMP_RESCORE_BUTTON_ENABLED = true;

export default function RecruiterDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [applications, setApplications] = useState<(ExternalApplication & { score?: ApplicationScore | null })[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ roleCategories: string[]; companies: string[]; sources: string[] }>({ roleCategories: [], companies: [], sources: [] });
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Hiring tab state
  const [hiringCount, setHiringCount] = useState(5);
  const [hiringRoleFilter, setHiringRoleFilter] = useState("");
  const [hiringMinScore, setHiringMinScore] = useState(0);
  const [hiringSourceFilter, setHiringSourceFilter] = useState("");
  const [exportingSheet, setExportingSheet] = useState(false);
  const [rescoringAll, setRescoringAll] = useState(false);

  // Talent Pool state
  const [talentPool, setTalentPool] = useState<any[]>([]);
  const [talentRoles, setTalentRoles] = useState<string[]>([]);
  const [talentRoleFilter, setTalentRoleFilter] = useState("");
  const [talentLoading, setTalentLoading] = useState(false);



  // Detail
  const [detailApp, setDetailApp] = useState<(ExternalApplication & { score?: ApplicationScore | null }) | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/recruiter/dashboard");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.filterOptions) setFilterOptions(data.filterOptions);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("roleCategory", roleFilter);
      if (companyFilter) params.set("companyName", companyFilter);
      if (sourceFilter) params.set("sourcePlatform", sourceFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("includeFilters", "true");

      const res = await fetch(`/api/v2/recruiter/applications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        if (data.filterOptions) setFilterOptions(data.filterOptions);
      }
    } catch { /* ignore */ }
  }, [roleFilter, companyFilter, sourceFilter, statusFilter]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("roleCategory", roleFilter);
      if (companyFilter) params.set("companyName", companyFilter);
      if (sourceFilter) params.set("sourcePlatform", sourceFilter);

      const res = await fetch(`/api/v2/recruiter/leaderboard?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch { /* ignore */ }
  }, [roleFilter, companyFilter, sourceFilter]);

  const fetchTalentPool = useCallback(async () => {
    setTalentLoading(true);
    try {
      const params = new URLSearchParams();
      if (talentRoleFilter) params.set("role", talentRoleFilter);

      const res = await fetch(`/api/v2/recruiter/talent-pool?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTalentPool(data.candidates || []);
        setTalentRoles(data.roles || []);
      }
    } catch { /* ignore */ }
    setTalentLoading(false);
  }, [talentRoleFilter]);

  useEffect(() => {
    Promise.all([fetchStats(), fetchApplications()]).finally(() => setLoading(false));
  }, [fetchStats, fetchApplications]);

  useEffect(() => { if (tab === "applications") fetchApplications(); }, [tab, fetchApplications]);
  useEffect(() => { if (tab === "leaderboard") fetchLeaderboard(); }, [tab, fetchLeaderboard]);
  useEffect(() => { if (tab === "talent-pool") fetchTalentPool(); }, [tab, fetchTalentPool]);

  // Auto-refresh every 8s if any application is still being scored
  useEffect(() => {
    const hasPendingScores = applications.some(
      (a) => a.scoreStatus === "processing" || a.scoreStatus === "pending"
    );
    if (!hasPendingScores) return;

    const timer = setInterval(() => {
      fetchApplications();
      fetchStats();
    }, 8000);

    return () => clearInterval(timer);
  }, [applications, fetchApplications, fetchStats]);



  // === HIRING EXCEL EXPORT ===
  const handleExportSheet = async () => {
    setExportingSheet(true);
    try {
      const res = await fetch("/api/v2/recruiter/hiring-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: hiringCount,
          roleCategory: hiringRoleFilter || undefined,
          sourcePlatform: hiringSourceFilter || undefined,
          minScore: hiringMinScore || undefined,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") || "";
        const fileNameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
        const fileName = fileNameMatch?.[1] || `zenai_top_${hiringCount}_candidates.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded top ${hiringCount} candidates as Excel sheet`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Export failed");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingSheet(false);
    }
  };

  const handleStatusChange = async (appId: string, status: string) => {
    try {
      const res = await fetch("/api/v2/recruiter/applications/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, status }),
      });
      if (res.ok) {
        toast.success(`Updated to ${status}`);
        fetchApplications();
        fetchStats();
      }
    } catch { toast.error("Update failed"); }
  };

  const handleTemporaryRescoreAll = async () => {
    if (rescoringAll) return;

    const confirmed = window.confirm(
      "This will clear existing interview scores and re-run AI scoring for completed interviews. Continue?"
    );
    if (!confirmed) return;

    setRescoringAll(true);
    try {
      const rescoreRes = await fetch("/api/v2/recruiter/rescore", {
        method: "POST",
      });
      const rescoreData = await rescoreRes.json().catch(() => ({}));
      if (!rescoreRes.ok) {
        throw new Error(
          rescoreData?.error ||
          rescoreData?.details ||
          "Failed to start re-scoring"
        );
      }

      const processRes = await fetch("/api/v2/recruiter/process-scores", {
        method: "POST",
      });
      const processData = await processRes.json().catch(() => ({}));

      if (!processRes.ok) {
        toast.warning("Re-score queued, but immediate score processing trigger failed.");
      }

      await Promise.all([fetchStats(), fetchApplications(), fetchLeaderboard()]);

      const enqueued = Number(rescoreData?.enqueued || 0);
      const processed = Number(processData?.processed || 0);
      toast.success(
        processed > 0
          ? `Re-score queued for ${enqueued} applications. Processed ${processed} jobs.`
          : `Re-score queued for ${enqueued} applications.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to re-score interviews");
    } finally {
      setRescoringAll(false);
    }
  };

  // Enrich applications with scores
  const enrichedApps = useMemo(() => {
    return (searchQuery
      ? applications.filter((a) =>
          a.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.roleTitle.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : applications
    );
  }, [applications, searchQuery]);

  // Merge backend leaderboard with scored applications
  const effectiveLeaderboard = useMemo((): LeaderboardEntry[] => {
    const merged = new Map<string, LeaderboardEntry>();

    leaderboard.forEach((entry) => {
      merged.set(entry.applicationId, { ...entry });
    });

    // Also pull from application scores
    applications.forEach((app) => {
      if (merged.has(app.id)) return;
      if (!app.score) return;

      merged.set(app.id, {
        rank: 0,
        applicationId: app.id,
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        roleTitle: app.roleTitle,
        companyName: app.companyName,
        sourcePlatform: app.sourcePlatform,
        overallScore: app.score.overallScore,
        technicalScore: app.score.technicalScore,
        communicationScore: app.score.communicationScore,
        problemSolvingScore: app.score.problemSolvingScore,
        recommendation: app.score.recommendation,
      });
    });

    const scored = Array.from(merged.values())
      .map((app) => ({
        ...app,
        overallScore: Number(app.overallScore || 0),
      } as LeaderboardEntry))
      .filter((entry) => Number.isFinite(entry.overallScore));

    scored.sort((a, b) => b.overallScore - a.overallScore);
    scored.forEach((entry, idx) => { entry.rank = idx + 1; });
    return scored;
  }, [leaderboard, applications]);

  // Filtered leaderboard for Hiring tab
  const hiringLeaderboard = useMemo(() => {
    let filtered = [...effectiveLeaderboard];
    if (hiringRoleFilter) {
      filtered = filtered.filter((e) =>
        e.roleTitle.toLowerCase().includes(hiringRoleFilter.toLowerCase())
      );
    }
    if (hiringSourceFilter) {
      filtered = filtered.filter((e) => e.sourcePlatform === hiringSourceFilter);
    }
    if (hiringMinScore > 0) {
      filtered = filtered.filter((e) => e.overallScore >= hiringMinScore);
    }
    return filtered;
  }, [effectiveLeaderboard, hiringRoleFilter, hiringSourceFilter, hiringMinScore]);

  const hiringTopCandidates = useMemo(() => {
    return hiringLeaderboard.slice(0, hiringCount);
  }, [hiringLeaderboard, hiringCount]);

  const overviewTopCandidates = useMemo((): LeaderboardEntry[] => {
    const statsCandidates = Array.isArray(stats?.topCandidates)
      ? (stats.topCandidates as LeaderboardEntry[])
      : [];

    if (statsCandidates.length > 0) {
      return statsCandidates.slice(0, 5);
    }

    return effectiveLeaderboard.slice(0, 5);
  }, [stats, effectiveLeaderboard]);

  const scoreColor = (s: number) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : s >= 40 ? "text-orange-400" : "text-red-400";

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/15 text-yellow-400",
      invited: "bg-blue-500/15 text-blue-400",
      in_progress: "bg-orange-500/15 text-orange-400",
      completed: "bg-cyan-500/15 text-cyan-400",
      shortlisted: "bg-emerald-500/15 text-emerald-400",
      rejected: "bg-red-500/15 text-red-400",
      available: "bg-emerald-500/15 text-emerald-400",
    };
    return colors[status] || colors.pending;
  };

  const recBadgeColor = (rec: string) => {
    if (rec === "strong_hire") return "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";
    if (rec === "hire") return "bg-green-500/15 border-green-500/30 text-green-400";
    if (rec === "maybe") return "bg-amber-500/15 border-amber-500/30 text-amber-400";
    return "bg-red-500/15 border-red-500/30 text-red-500";
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <>
    {/* Mobile Tab Bar */}
    <div className="flex md:hidden gap-2 mb-4 overflow-x-auto pb-2">
      {([
        { key: "overview", label: "Dashboard", icon: BarChart3 },
        { key: "jobs", label: "Jobs", icon: Briefcase },
        { key: "applications", label: "Apps", icon: Users },
        { key: "leaderboard", label: "Rankings", icon: Trophy },
        { key: "talent-pool", label: "Talent", icon: Globe },
        { key: "hiring", label: "Hire", icon: UserCheck },
        { key: "schedule", label: "Schedule", icon: CalendarDays },
      ] as const).map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            tab === key
              ? "bg-[#A3E635] text-black shadow-lg"
              : "bg-white/[0.04] text-[#888] hover:text-white"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>

    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Dock */}
      <div className="hidden md:flex flex-col items-center py-6 gap-6 w-20 shrink-0 bg-[#0A0A0A]/40 border border-white/[0.04] backdrop-blur-3xl rounded-3xl sticky top-24 h-fit z-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {([
          { key: "overview", label: "Dashboard", icon: BarChart3 },
          { key: "jobs", label: "Job Postings", icon: Briefcase },
          { key: "applications", label: "Applications", icon: Users },
          { key: "leaderboard", label: "Leaderboard", icon: Trophy },
          { key: "talent-pool", label: "Talent Pool", icon: Globe },
          { key: "hiring", label: "Hire Candidates", icon: UserCheck },
          { key: "schedule", label: "Interview Schedule", icon: CalendarDays },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            title={label}
            onClick={() => setTab(key)}
            className={`p-4 rounded-xl transition-all duration-300 ${
              tab === key
                ? "bg-[#A3E635] text-black shadow-[0_0_20px_rgba(163,230,53,0.3)] hover:scale-105"
                : "text-[#888] hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-6 h-6" />
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Recruiter Analytics</h1>
            <p className="text-muted-foreground mt-2 text-lg">AI-powered interview analysis & candidate scoring workspace.</p>
          </div>
          {TEMP_RESCORE_BUTTON_ENABLED && (
            <button
              onClick={handleTemporaryRescoreAll}
              disabled={rescoringAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#A3E635]/40 bg-[#A3E635]/10 text-[#D6FF6D] text-xs font-semibold uppercase tracking-wider hover:bg-[#A3E635]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Temporary testing control: clear and re-run AI scoring"
            >
              {rescoringAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {rescoringAll ? "Re-scoring..." : "Temp: Re-score All"}
            </button>
          )}
        </div>

      {/* ========== OVERVIEW TAB ========== */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Applications", value: stats.totalApplications, icon: Users, color: "text-blue-400" },
              { label: "Interviews Done", value: stats.completedInterviews, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Pending", value: stats.pendingInterviews, icon: Clock, color: "text-yellow-400" },
              { label: "Avg Score", value: stats.averageScore || "—", icon: TrendingUp, color: "text-primary" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "By Role", data: stats.byRole, icon: Award },
              { title: "By Company", data: stats.byCompany, icon: Building2 },
              { title: "By Source", data: stats.bySource, icon: Globe },
            ].map(({ title, data, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(data || {}).slice(0, 5).map(([key, count]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{key}</span>
                      <span className="text-foreground font-medium">{count as number}</span>
                    </div>
                  ))}
                  {(!data || Object.keys(data).length === 0) && (
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Top candidates */}
          {overviewTopCandidates.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Top Candidates</h3>
              </div>
              <div className="space-y-2">
                {overviewTopCandidates.map((c: LeaderboardEntry, i: number) => (
                  <div key={c.applicationId} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-lg font-bold text-primary w-6 text-center">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{c.roleTitle} · {c.companyName}</p>
                    </div>
                    <span className={`text-lg font-bold ${scoreColor(c.overallScore)}`}>{c.overallScore}</span>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full border uppercase ${recBadgeColor(c.recommendation)}`}>
                      {c.recommendation.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== APPLICATIONS TAB ========== */}
      {tab === "applications" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text" placeholder="Search candidates..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Roles</option>
              {filterOptions.roleCategories.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Companies</option>
              {filterOptions.companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Sources</option>
              {filterOptions.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="completed">Completed</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Table */}
          <div className="space-y-3 mt-6">
            <div className="hidden md:flex items-center px-4 md:px-6 py-2 text-xs font-semibold text-[#888] uppercase tracking-widest">
               <div className="flex-1">Candidate Profile</div>
               <div className="w-48">Role & Company</div>
               <div className="w-32">Status</div>
               <div className="w-24 text-center">Score</div>
               <div className="w-28 text-right">Actions</div>
            </div>
            {enrichedApps.length === 0 && (
              <div className="text-center py-16 text-[#888] bg-white/[0.01] rounded-3xl border border-white/5">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-base">No applications found. Import data to populate workspace.</p>
              </div>
            )}

            {enrichedApps.map((app) => (
              <div key={app.id} className="group relative flex flex-col md:flex-row md:items-center gap-4 bg-[#0A0A0A]/40 hover:bg-[#FAFAFA]/[0.03] border border-white/[0.03] hover:border-white/10 p-4 md:p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                     <span className="text-lg font-bold text-white/80 uppercase">{app.candidateName.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-lg">{app.candidateName}</p>
                    <p className="text-xs text-[#888]">{app.candidateEmail}</p>
                  </div>
                </div>

                <div className="md:w-48 flex flex-col">
                  <p className="text-foreground text-sm font-medium">{app.roleTitle}</p>
                  <p className="text-xs text-[#888]">{app.companyName} • <span className="text-[#A3E635] capitalize">{app.roleCategory || app.sourcePlatform}</span></p>
                </div>

                <div className="md:w-32">
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border ${
                    app.status === "completed" ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" :
                    app.status === "shortlisted" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    app.status === "rejected" ? "bg-red-500/10 border-red-500/20 text-red-500" :
                    app.status === "invited" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                    "bg-white/5 border-white/10 text-white/50"
                  }`}>
                    {app.status}
                  </span>
                </div>

                <div className="md:w-24 flex justify-center">
                  {app.score ? (
                    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0" title={`Score: ${app.score.overallScore}/100`}>
                      <svg className="absolute w-12 h-12 transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className={`${scoreColor(app.score.overallScore).replace('text-', 'text-')} drop-shadow-[0_0_8px_rgba(163,230,53,0.4)]`} strokeDasharray="125" strokeDashoffset={125 - (125 * Math.min(app.score.overallScore, 100) / 100)} strokeLinecap="round" />
                      </svg>
                      <span className={`relative z-10 text-xs font-bold ${scoreColor(app.score.overallScore)}`}>{Math.round(app.score.overallScore)}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-[#888] font-medium flex items-center gap-1">
                      {app.scoreStatus === "processing" ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> <span className="text-xs">Scoring...</span></>
                      ) : "—"}
                    </span>
                  )}
                </div>

                <div className="md:w-28 flex items-center justify-end gap-1.5">
                  <button onClick={() => setDetailApp(app)} className="p-2 rounded-full cursor-pointer bg-white/[0.03] hover:bg-white/10 text-[#888] hover:text-white transition-colors"><Eye className="w-4 h-4" /></button>
                  {app.status !== "shortlisted" && <button onClick={() => handleStatusChange(app.id, "shortlisted")} className="p-2 rounded-full bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-500 transition-colors"><ThumbsUp className="w-4 h-4" /></button>}
                  {app.status !== "rejected" && <button onClick={() => handleStatusChange(app.id, "rejected")} className="p-2 rounded-full bg-red-500/5 hover:bg-red-500/20 text-red-500 transition-colors"><ThumbsDown className="w-4 h-4" /></button>}
                  {app.inviteLink && <a href={app.inviteLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-blue-500/5 hover:bg-blue-500/20 text-blue-400 transition-colors"><ExternalLink className="w-4 h-4" /></a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== LEADERBOARD TAB ========== */}
      {tab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Roles</option>
              {filterOptions.roleCategories.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-foreground appearance-none">
              <option value="">All Companies</option>
              {filterOptions.companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Leaderboard cards */}
          <div className="space-y-3 mt-6">
            <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-widest pl-4">
               <div className="w-16">Rank</div>
               <div className="flex-1">Candidate Profile</div>
               <div className="w-48">Role details</div>
               <div className="w-24 text-center">Score</div>
               <div className="w-36 text-right pr-4">Recommendation</div>
            </div>
            {effectiveLeaderboard.length === 0 && (
              <div className="text-center py-16 text-[#888] bg-white/[0.01] rounded-3xl border border-white/5">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-base">No scored candidates yet. Interviews are analyzed automatically after completion.</p>
              </div>
            )}

            {effectiveLeaderboard.map((entry) => (
               <div key={entry.applicationId} className="group flex flex-col md:flex-row md:items-center gap-4 bg-[#0A0A0A]/40 hover:bg-[#FAFAFA]/[0.03] border border-white/[0.03] hover:border-[#A3E635]/30 p-4 md:p-5 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(163,230,53,0.1)] hover:-translate-y-1">
                  <div className="md:w-16 flex justify-center md:justify-start pl-2">
                     <span className={`text-3xl font-black ${entry.rank <= 3 ? "text-[#A3E635] drop-shadow-[0_0_12px_rgba(163,230,53,0.4)]" : "text-white/20"}`}>#{entry.rank}</span>
                  </div>

                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                       <span className={`text-lg font-bold capitalize ${entry.rank <= 3 ? "text-white" : "text-white/50"}`}>{entry.candidateName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-lg">{entry.candidateName}</p>
                      <p className="text-xs text-[#888]">{entry.candidateEmail}</p>
                    </div>
                  </div>

                  <div className="md:w-48">
                    <p className="text-foreground text-sm font-medium">{entry.roleTitle}</p>
                    <p className="text-xs text-[#888]">{entry.companyName}</p>
                  </div>

                  <div className="md:w-24 flex justify-center">
                    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                      <svg className="absolute w-12 h-12 transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className={`${scoreColor(entry.overallScore).replace('text-', 'text-')} drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]`} strokeDasharray="125" strokeDashoffset={125 - (125 * Math.min(entry.overallScore, 100) / 100)} strokeLinecap="round" />
                      </svg>
                      <span className={`relative z-10 text-xs font-bold ${scoreColor(entry.overallScore)}`}>{Math.round(entry.overallScore)}</span>
                    </div>
                  </div>

                  <div className="md:w-36 flex justify-end">
                     <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border uppercase tracking-wider ${recBadgeColor(entry.recommendation)}`}>
                       {entry.recommendation.replace("_", " ")}
                     </span>
                  </div>
               </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== HIRING TAB ========== */}
      {tab === "hiring" && (
        <div className="space-y-6">
          {/* Hero card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0A0A0A]/60 to-[#1a1a2e]/40 backdrop-blur-sm p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#A3E635]/15 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-[#A3E635]" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Hiring Selection</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-8">Configure your hiring criteria and download a shortlist of top candidates with their AI-analyzed scores.</p>

            {/* Configuration grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Number of hires */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Candidates to Hire
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={hiringCount}
                  onChange={(e) => setHiringCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm font-medium focus:outline-none focus:border-[#A3E635]/50 focus:ring-1 focus:ring-[#A3E635]/20 transition-all"
                />
              </div>

              {/* Role filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Filter by Role
                </label>
                <select
                  value={hiringRoleFilter}
                  onChange={(e) => setHiringRoleFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm appearance-none focus:outline-none focus:border-[#A3E635]/50 focus:ring-1 focus:ring-[#A3E635]/20 transition-all"
                >
                  <option value="">All Roles</option>
                  {filterOptions.roleCategories.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Min score filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Minimum Score
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={hiringMinScore}
                  onChange={(e) => setHiringMinScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm font-medium focus:outline-none focus:border-[#A3E635]/50 focus:ring-1 focus:ring-[#A3E635]/20 transition-all"
                />
              </div>

              {/* Source filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Filter by Source
                </label>
                <select
                  value={hiringSourceFilter}
                  onChange={(e) => setHiringSourceFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-foreground text-sm appearance-none focus:outline-none focus:border-[#A3E635]/50 focus:ring-1 focus:ring-[#A3E635]/20 transition-all"
                >
                  <option value="">All Sources</option>
                  {filterOptions.sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Export button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleExportSheet}
                disabled={exportingSheet || hiringTopCandidates.length === 0}
                className="flex items-center gap-2.5 bg-[#A3E635] hover:bg-[#B3F245] text-black font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#A3E635]/20 hover:shadow-[#A3E635]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {exportingSheet ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                Download Excel Sheet ({hiringTopCandidates.length} Candidates)
              </button>
              <p className="text-xs text-[#888]">
                {hiringLeaderboard.length > 0
                  ? `${hiringLeaderboard.length} matching candidates found · Showing top ${Math.min(hiringCount, hiringLeaderboard.length)}`
                  : "No candidates match your criteria"}
              </p>
            </div>
          </div>

          {/* Preview of selected candidates */}
          {hiringTopCandidates.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A]/40 backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#A3E635]" />
                  <h3 className="text-sm font-semibold text-foreground">Selected Candidates Preview</h3>
                </div>
                <span className="text-xs text-[#888] bg-white/5 px-3 py-1 rounded-full">
                  Top {hiringTopCandidates.length} of {hiringLeaderboard.length}
                </span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {hiringTopCandidates.map((entry, idx) => (
                  <div key={entry.applicationId} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    <span className={`text-xl font-black w-8 text-center ${idx < 3 ? "text-[#A3E635]" : "text-white/20"}`}>
                      #{idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white/70 uppercase">{entry.candidateName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{entry.candidateName}</p>
                      <p className="text-xs text-[#888] truncate">{entry.candidateEmail}</p>
                    </div>
                    <div className="hidden md:block w-40">
                      <p className="text-xs font-medium text-foreground truncate">{entry.roleTitle}</p>
                      <p className="text-xs text-[#888] truncate">{entry.companyName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-lg font-bold ${scoreColor(entry.overallScore)}`}>{Math.round(entry.overallScore)}</p>
                        <p className="text-[9px] text-[#888] uppercase">Score</p>
                      </div>
                      <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${recBadgeColor(entry.recommendation)}`}>
                        {entry.recommendation.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hiringTopCandidates.length === 0 && (
            <div className="text-center py-16 text-[#888] bg-white/[0.01] rounded-3xl border border-white/5">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-base mb-2">No candidates match your criteria</p>
              <p className="text-xs text-[#666]">Try adjusting the filters or lowering the minimum score.</p>
            </div>
          )}
        </div>
      )}
    </div>

      {/* ========== TALENT POOL TAB ========== */}
      {tab === "talent-pool" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Open Talent Pool</h2>
                <p className="text-muted-foreground text-xs">Candidates actively looking for opportunities</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={talentRoleFilter} 
                onChange={(e) => setTalentRoleFilter(e.target.value)} 
                className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2 text-sm text-foreground appearance-none min-w-[150px]"
              >
                <option value="">All Roles</option>
                {talentRoles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold text-[#888] uppercase tracking-widest pl-4">
               <div className="w-16">Rank</div>
               <div className="flex-1">Candidate Profile</div>
               <div className="w-48">Role details</div>
               <div className="w-24 text-center">Score</div>
               <div className="w-36 text-right pr-4">Recommendation</div>
            </div>
            
            {talentLoading && (
              <div className="flex items-center justify-center py-16 text-[#888] bg-white/[0.01] rounded-3xl border border-white/5">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
            
            {!talentLoading && talentPool.length === 0 && (
              <div className="text-center py-16 text-[#888] bg-white/[0.01] rounded-3xl border border-white/5">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-base mb-2">No candidates found in the talent pool.</p>
                <p className="text-xs text-[#666]">Candidates who opt-in for visibility will appear here.</p>
              </div>
            )}

            {!talentLoading && talentPool.map((entry, idx) => (
               <div key={entry.id} className="group flex flex-col md:flex-row md:items-center gap-4 bg-[#0A0A0A]/40 hover:bg-[#FAFAFA]/[0.03] border border-white/[0.03] hover:border-purple-500/30 p-4 md:p-5 rounded-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:-translate-y-1">
                  <div className="md:w-16 flex justify-center md:justify-start pl-2">
                     <span className={`text-3xl font-black ${idx <= 2 ? "text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]" : "text-white/20"}`}>#{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                       <span className={`text-lg font-bold capitalize ${idx <= 2 ? "text-white" : "text-white/50"}`}>{entry.userName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-lg">{entry.userName}</p>
                      <p className="text-xs text-[#888]">{entry.userEmail}</p>
                    </div>
                  </div>

                  <div className="md:w-48">
                    <p className="text-foreground text-sm font-medium">{entry.role}</p>
                    <p className="text-xs text-[#888] capitalize">{entry.interviewType} Interview</p>
                  </div>

                  <div className="md:w-24 flex justify-center">
                    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                      <svg className="absolute w-12 h-12 transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="transparent" className={`${scoreColor(entry.overallScore).replace('text-', 'text-')} drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]`} strokeDasharray="125" strokeDashoffset={125 - (125 * Math.min(entry.overallScore, 100) / 100)} strokeLinecap="round" />
                      </svg>
                      <span className={`relative z-10 text-xs font-bold ${scoreColor(entry.overallScore)}`}>{Math.round(entry.overallScore)}</span>
                    </div>
                  </div>

                  <div className="md:w-36 flex flex-col items-end gap-2">
                     <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border uppercase tracking-wider ${recBadgeColor(entry.recommendation)}`}>
                       {entry.recommendation.replace("_", " ")}
                     </span>
                     <button 
                       onClick={() => {
                         // Adapting talent pool entry to detailApp structure for viewing
                         setDetailApp({
                           id: entry.id,
                           candidateName: entry.userName,
                           candidateEmail: entry.userEmail,
                           roleTitle: entry.role,
                           roleCategory: entry.role,
                           companyName: "Talent Pool",
                           sourcePlatform: "ZenAI",
                           status: "available",
                           score: {
                             overallScore: entry.overallScore,
                             technicalScore: entry.technicalScore,
                             communicationScore: entry.communicationScore,
                             problemSolvingScore: entry.problemSolvingScore,
                             recommendation: entry.recommendation,
                             feedbackSummary: entry.feedbackSummary,
                             strengths: entry.strengths,
                             weaknesses: entry.weaknesses
                           }
                         } as any);
                       }}
                       className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                     >
                       <Eye className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            ))}
          </div>
        </div>
      )}
    </div>

      {/* ========== DETAIL PANEL ========== */}
      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailApp(null)}>
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Application Details</h2>
              <button onClick={() => setDetailApp(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary">
                  {detailApp.candidateName.charAt(0)}
                </div>
                <div>
                  <p className="text-foreground font-semibold">{detailApp.candidateName}</p>
                  <p className="text-xs text-muted-foreground">{detailApp.candidateEmail}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-muted-foreground">Role</p>
                  <p className="text-foreground font-medium">{detailApp.roleTitle}</p>
                  <p className="text-primary capitalize">{detailApp.roleCategory}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-muted-foreground">Company</p>
                  <p className="text-foreground font-medium">{detailApp.companyName}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-muted-foreground">Source</p>
                  <p className="text-foreground font-medium capitalize">{detailApp.sourcePlatform}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-muted-foreground">Status</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(detailApp.status)}`}>{detailApp.status}</span>
                </div>
              </div>

              {detailApp.score && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    AI Interview Analysis
                  </h3>
                  {[
                    { label: "Overall", score: detailApp.score.overallScore },
                    { label: "Technical", score: detailApp.score.technicalScore },
                    { label: "Communication", score: detailApp.score.communicationScore },
                    { label: "Problem Solving", score: detailApp.score.problemSolvingScore },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={scoreColor(score)}>{score}/100</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500"
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Recommendation */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Recommendation:</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase ${recBadgeColor(detailApp.score.recommendation)}`}>
                      {detailApp.score.recommendation.replace("_", " ")}
                    </span>
                  </div>

                  {/* Strengths */}
                  {detailApp.score.strengths && detailApp.score.strengths.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-emerald-400">Strengths:</p>
                      {detailApp.score.strengths.map((s, i) => (
                        <p key={i} className="text-xs text-foreground/70 pl-3 border-l-2 border-emerald-500/30">
                          {s}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Weaknesses */}
                  {detailApp.score.weaknesses && detailApp.score.weaknesses.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-400">Weaknesses:</p>
                      {detailApp.score.weaknesses.map((w, i) => (
                        <p key={i} className="text-xs text-foreground/70 pl-3 border-l-2 border-red-500/30">
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {detailApp.score.feedbackSummary && (
                    <div className="p-3 rounded-lg bg-white/[0.03] text-xs text-foreground/80 leading-relaxed border-l-2 border-violet-500/30">
                      <p className="text-xs font-semibold text-violet-400 mb-1">AI Assessment:</p>
                      {detailApp.score.feedbackSummary}
                    </div>
                  )}
                </div>
              )}

              {!detailApp.score && (
                <div className="p-4 rounded-lg bg-white/[0.02] text-center">
                  <p className="text-xs text-[#888]">No AI analysis available yet. Use &quot;Temp: Re-score All&quot; to analyze this interview.</p>
                </div>
              )}

              {detailApp.externalJobUrl && (
                <a href={detailApp.externalJobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> View original job posting
                </a>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => { handleStatusChange(detailApp.id, "shortlisted"); setDetailApp(null); }} className="flex-1 bg-emerald-500/15 text-emerald-400 text-sm font-medium py-2 rounded-lg hover:bg-emerald-500/25 transition-colors">Shortlist</button>
                <button onClick={() => { handleStatusChange(detailApp.id, "rejected"); setDetailApp(null); }} className="flex-1 bg-red-500/15 text-red-400 text-sm font-medium py-2 rounded-lg hover:bg-red-500/25 transition-colors">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {tab === "jobs" && (
        <JobManagementDashboard />
      )}

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <ScheduleTab />
      )}
    </>
  );
}
