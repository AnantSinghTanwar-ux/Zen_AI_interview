"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  BarChart3, Users, CheckCircle2, Clock, TrendingUp,
  Upload, Send, Trophy, Loader2, Building2, Globe,
  Filter, ChevronDown, ThumbsUp, ThumbsDown, Mail,
  Award, ExternalLink, Search, ArrowUpDown, Eye
} from "lucide-react";
import type { ExternalApplication, ApplicationScore, LeaderboardEntry } from "@/types/external-application";

type Tab = "overview" | "applications" | "leaderboard" | "import";

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

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

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

  useEffect(() => {
    Promise.all([fetchStats(), fetchApplications()]).finally(() => setLoading(false));
  }, [fetchStats, fetchApplications]);

  useEffect(() => { if (tab === "applications") fetchApplications(); }, [tab, fetchApplications]);
  useEffect(() => { if (tab === "leaderboard") fetchLeaderboard(); }, [tab, fetchLeaderboard]);

  // Import handlers
  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { toast.error("Invalid CSV"); return; }
    const header = lines[0].split(",").map((h) => h.trim());
    const preview = lines.slice(1, 6).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h] = cols[i] || ""; });
      return obj;
    });
    setImportPreview(preview);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/v2/recruiter/applications/import", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.imported} applications (${data.skipped} skipped)`);
        setImportFile(null);
        setImportPreview([]);
        fetchStats();
        fetchApplications();
        setTab("applications");
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch { toast.error("Import failed"); } finally { setImporting(false); }
  };

  // Selection & actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    const pending = applications.filter((a) => a.interviewStatus === "pending");
    setSelectedIds(new Set(pending.map((a) => a.id)));
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/v2/recruiter/interview/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Assigned ${data.assigned} interviews${data.failed ? ` (${data.failed} failed)` : ""}`);
        setSelectedIds(new Set());
        fetchApplications();
        fetchStats();
      } else {
        toast.error(data.error || "Assignment failed");
      }
    } catch { toast.error("Assignment failed"); } finally { setAssigning(false); }
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

  // Filter applications by search query
  const filteredApps = searchQuery
    ? applications.filter((a) =>
        a.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.roleTitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : applications;

  const scoreColor = (s: number) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : "text-red-400";

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

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recruiter Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">External application pipeline & candidate scoring</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/10">
        {([
          { key: "overview", label: "Dashboard", icon: BarChart3 },
          { key: "applications", label: "Applications", icon: Users },
          { key: "leaderboard", label: "Leaderboard", icon: Trophy },
          { key: "import", label: "Import", icon: Upload },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              tab === key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
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
          {stats.topCandidates?.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Top Candidates</h3>
              </div>
              <div className="space-y-2">
                {stats.topCandidates.map((c: LeaderboardEntry, i: number) => (
                  <div key={c.applicationId} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-lg font-bold text-primary w-6 text-center">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{c.roleTitle} · {c.companyName}</p>
                    </div>
                    <span className={`text-lg font-bold ${scoreColor(c.overallScore)}`}>{c.overallScore}</span>
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

          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={selectAllPending} className="text-xs text-primary hover:underline">Select all pending</button>
              {selectedIds.size > 0 && (
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              )}
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-xs font-medium px-4 py-2 rounded-full transition-all disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Assign Interviews ({selectedIds.size})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="p-3 text-left w-10"><input type="checkbox" className="accent-primary" /></th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Candidate</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Source</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Score</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="accent-primary"
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-foreground font-medium">{app.candidateName}</p>
                          <p className="text-xs text-muted-foreground">{app.candidateEmail}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-foreground text-xs">{app.roleTitle}</p>
                        <span className="text-[10px] text-primary capitalize">{app.roleCategory}</span>
                      </td>
                      <td className="p-3 text-xs text-foreground">{app.companyName}</td>
                      <td className="p-3">
                        <span className="text-xs capitalize text-muted-foreground">{app.sourcePlatform}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(app.status)}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {app.score ? (
                          <span className={`text-sm font-bold ${scoreColor(app.score.overallScore)}`}>
                            {app.score.overallScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDetailApp(app)} className="p-1 text-muted-foreground hover:text-foreground"><Eye className="w-3.5 h-3.5" /></button>
                          {app.status !== "shortlisted" && (
                            <button onClick={() => handleStatusChange(app.id, "shortlisted")} className="p-1 text-emerald-400 hover:text-emerald-300"><ThumbsUp className="w-3.5 h-3.5" /></button>
                          )}
                          {app.status !== "rejected" && (
                            <button onClick={() => handleStatusChange(app.id, "rejected")} className="p-1 text-red-400 hover:text-red-300"><ThumbsDown className="w-3.5 h-3.5" /></button>
                          )}
                          {app.inviteLink && (
                            <a href={app.inviteLink} target="_blank" rel="noopener noreferrer" className="p-1 text-primary hover:text-primary/80"><ExternalLink className="w-3.5 h-3.5" /></a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredApps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No applications found. Import some first!</p>
              </div>
            )}
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

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground w-14">Rank</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Candidate</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Source</th>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">Overall</th>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">Tech</th>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">Comm</th>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">Problem</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => (
                  <tr key={entry.applicationId} className="hover:bg-white/[0.02]">
                    <td className="p-3">
                      <span className={`text-lg font-bold ${entry.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="text-foreground font-medium">{entry.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{entry.candidateEmail}</p>
                    </td>
                    <td className="p-3 text-xs text-foreground">{entry.roleTitle}</td>
                    <td className="p-3 text-xs text-foreground">{entry.companyName}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{entry.sourcePlatform}</td>
                    <td className="p-3 text-center"><span className={`text-sm font-bold ${scoreColor(entry.overallScore)}`}>{entry.overallScore}</span></td>
                    <td className="p-3 text-center text-xs text-foreground">{entry.technicalScore}</td>
                    <td className="p-3 text-center text-xs text-foreground">{entry.communicationScore}</td>
                    <td className="p-3 text-center text-xs text-foreground">{entry.problemSolvingScore}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        entry.recommendation === "strong_hire" || entry.recommendation === "hire"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : entry.recommendation === "maybe"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-red-500/15 text-red-400"
                      }`}>
                        {entry.recommendation.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No scored candidates yet. Assign & complete interviews first.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== IMPORT TAB ========== */}
      {tab === "import" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-card/60 backdrop-blur-sm p-8">
            <h2 className="text-lg font-bold text-foreground mb-2">Import External Applications</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Upload a CSV with columns: <code className="text-primary">name, email, company, role, source, category, resumeUrl, externalJobId, externalJobUrl</code>
            </p>

            <div
              className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById("ext-import-file")?.click()}
            >
              <input
                id="ext-import-file" type="file" accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-foreground font-medium">{importFile ? importFile.name : "Drop CSV or click to browse"}</p>
              <p className="text-xs text-muted-foreground mt-1">Supports CSV and JSON formats</p>
            </div>

            {importPreview.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Preview (first 5 rows):</h3>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/[0.03]">
                        {Object.keys(importPreview[0]).map((key) => (
                          <th key={key} className="p-2 text-left text-muted-foreground">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {importPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="p-2 text-foreground truncate max-w-[150px]">{val as string}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-all disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Import All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                  <h3 className="text-sm font-semibold text-foreground">Scores</h3>
                  {[
                    { label: "Overall", score: detailApp.score.overallScore },
                    { label: "Technical", score: detailApp.score.technicalScore },
                    { label: "Communication", score: detailApp.score.communicationScore },
                    { label: "Problem Solving", score: detailApp.score.problemSolvingScore },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={scoreColor(score)}>{score}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                  {detailApp.score.feedbackSummary && (
                    <div className="p-3 rounded-lg bg-white/[0.03] text-xs text-foreground/80 leading-relaxed">
                      {detailApp.score.feedbackSummary}
                    </div>
                  )}
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
    </div>
  );
}
