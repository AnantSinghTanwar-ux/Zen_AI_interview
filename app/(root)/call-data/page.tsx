"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { Clock, MessageSquare, Briefcase, FileText, ChevronRight, CalendarDays, Zap } from "lucide-react";

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

function CallDataPage() {
  const [callData, setCallData] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallData = async () => {
      try {
        console.log("Fetching call data...");
        const response = await fetch('/api/vapi/call-data');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Call data received:", data);

        if (Array.isArray(data)) {
          setCallData(data);
        } else {
          console.error("Expected array but got:", typeof data);
          setError("Invalid data format received");
        }
      } catch (err) {
        console.error('Error fetching call data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch call data');
      } finally {
        setLoading(false);
      }
    };

    fetchCallData();
  }, []);

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-background text-foreground relative py-20 pb-40">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#9d7df9] to-[#eca4ff] opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>
          <div className="p-6 pt-32 max-w-7xl mx-auto relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-12 flex items-center gap-4">
              <Briefcase className="w-10 h-10 text-primary opacity-80" strokeWidth={2} />
              Your Sessions
            </h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card h-64 border border-white/8 rounded-3xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-background text-foreground relative py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.05),transparent_50%)] pointer-events-none" />
          <div className="p-6 pt-32 max-w-7xl mx-auto relative z-10 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="glass-card rounded-3xl p-10 text-center max-w-2xl mx-auto w-full border border-red-500/20 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500/60 to-red-500/0" />
              <h2 className="text-red-400 font-semibold tracking-wide text-2xl mb-4">Error Loading Sessions</h2>
              <p className="text-foreground/85 font-light mb-8 text-lg leading-relaxed">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-500/10 text-red-400 px-8 py-3 rounded-full font-medium border border-red-500/30 hover:bg-red-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground relative py-20 pb-40">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#9d7df9] to-[#eca4ff] opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="p-6 pt-32 max-w-7xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-12 flex items-center gap-4">
            <Briefcase className="w-10 h-10 text-primary opacity-80" strokeWidth={2} />
            Your Sessions
          </h1>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-stagger-2">
            {callData.map((call, index, array) => {
              const totalInterviews = array.length;
              const interviewNumber = totalInterviews - index;
              const isEnded = call.status === 'ended';
              const durationMins = call.endedAt
                ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 60000)
                : null;

              return (
                <div
                  key={call.id}
                  className="glass-card hover:-translate-y-1 transition-all duration-300 rounded-3xl p-6 flex flex-col justify-between h-full group border border-white/8 hover:border-primary/40"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h3 className="text-foreground font-semibold text-lg tracking-wide group-hover:text-primary transition-colors">
                          Session #{interviewNumber}
                        </h3>
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {new Date(call.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Status Badge — clearly readable */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${
                        isEnded
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isEnded ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {call.status === 'ended' ? 'Ended' : 'In Progress'}
                      </span>
                    </div>

                    {/* Stats Row */}
                    <div className="space-y-2.5 mb-5 bg-white/4 backdrop-blur-md p-4 rounded-2xl border border-white/8">
                      {/* Duration */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary/80" />
                          Duration
                        </span>
                        <span className="font-semibold text-foreground/90 tabular-nums">
                          {durationMins !== null ? `${durationMins} min` : (
                            <span className="text-amber-300 text-xs font-medium">Ongoing</span>
                          )}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-primary/80" />
                          Time
                        </span>
                        <span className="font-semibold text-foreground/90 tabular-nums">
                          {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Messages */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-primary/80" />
                          Messages
                        </span>
                        <span className="font-semibold text-foreground/90 tabular-nums">
                          {call.messageCount || 0}
                        </span>
                      </div>

                      {/* Cost — de-emphasised but visible */}
                      {call.cost && (
                        <div className="flex items-center justify-between text-sm border-t border-white/8 pt-2.5 mt-1">
                          <span className="text-muted-foreground/90 font-medium flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-muted-foreground/80" />
                            API Cost
                          </span>
                          <span className="font-mono text-foreground/80 text-xs">${call.cost.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <Link
                      href={`/call-data/${call.id}`}
                      className="flex items-center justify-center gap-2 bg-white/8 text-foreground/90 font-semibold py-3 px-4 rounded-xl border border-white/15 hover:bg-white/12 hover:text-foreground hover:border-white/25 transition-all text-xs"
                    >
                      <FileText className="w-4 h-4" />
                      Details
                    </Link>
                    <Link
                      href={`/feedback?callId=${call.id}`}
                      className="flex items-center justify-center gap-2 bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl shadow-[0_0_15px_rgba(157,125,249,0.25)] hover:shadow-[0_0_22px_rgba(157,125,249,0.45)] hover:bg-primary transition-all text-xs group/btn"
                    >
                      Feedback
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {callData.length === 0 && (
            <div className="text-center py-20 px-6 glass-card rounded-3xl mt-12 max-w-2xl mx-auto border border-white/10 border-dashed">
              <Briefcase className="w-16 h-16 mx-auto text-muted-foreground/60 mb-6" />
              <p className="text-foreground font-semibold text-xl mb-3 tracking-wide">No sessions found</p>
              <p className="text-muted-foreground font-light leading-relaxed">Start a new simulated interview to begin tracking your performance and detailed metrics.</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default CallDataPage;