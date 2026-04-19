"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";
import EmotionVisualization from "@/components/EmotionVisualization";
import InterviewEvaluation from "@/components/InterviewEvaluation";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import { EmotionData } from "@/services/emotion/emotion-detection.service";
import { Activity, Brain, TrendingUp, Clock, MessageSquare, DollarSign, ChevronLeft, Cpu, FileText } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";

interface CallDetails {
  id: string;
  vapiCallId?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  costBreakdown?: {
    llm: number;
    stt: number;
    tts: number;
    vapi: number;
    total: number;
    analysisCostBreakdown?: any;
  };
  messages?: any[];
  emotionAnalysis?: {
    emotions: EmotionData[];
    dominantEmotion: string;
    emotionalTrend: 'improving' | 'declining' | 'stable';
    summary: {
      averageConfidence: number;
      mostFrequentEmotion: string;
      emotionalStability: number;
      stressIndicators: string[];
    };
  };
  artifact?: {
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    recording?: {
      stereoUrl?: string;
      mono?: {
        combinedUrl?: string;
        assistantUrl?: string;
        customerUrl?: string;
      };
    };
    messages?: any[];
    transcript?: string;
    performanceMetrics?: any;
  };
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: {
    summary?: string;
    successEvaluation?: string;
  };
  assistantId?: string;
  webCallUrl?: string;
  endedReason?: string;
  messageCount?: number;
  duration?: number;
}

export default function CallDetailsPage() {
  const params = useParams();
  const callId = params?.callId as string;
  const [callDetails, setCallDetails] = useState<CallDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!callId) {
      setError("Call ID is required");
      setLoading(false);
      return;
    }

    const fetchCallDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/vapi/call-data/${callId}`);

        if (response.status === 402) {
          const payload = await response.json().catch(() => ({}));
          setPremiumMessage(
            payload?.message ||
              "Premium is required to continue using this Vapi AI feature."
          );
          setShowPremiumPopup(true);
          throw new Error(payload?.message || "Premium subscription required");
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch call details: ${response.statusText}`);
        }

        const data = await response.json();
        setCallDetails(data);
      } catch (err) {
        console.error("Error fetching call details:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch call details");
      } finally {
        setLoading(false);
      }
    };

    fetchCallDetails();
  }, [callId]);

  const BackLink = () => (
    <Link
      href="/call-data"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-foreground text-sm font-medium transition-all duration-200"
    >
      <ChevronLeft className="w-4 h-4" />
      Back to Sessions
    </Link>
  );

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-background text-foreground py-20">
          <div className="max-w-7xl mx-auto px-6 pt-16">
            <div className="mb-8"><BackLink /></div>
            <div className="h-10 bg-white/5 rounded-xl w-64 mb-10 animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-48 animate-pulse" />
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
        <div className="min-h-screen bg-background text-foreground py-20">
          <div className="max-w-7xl mx-auto px-6 pt-16">
            <div className="mb-8"><BackLink /></div>
            <div className="glass-card rounded-2xl p-8 border border-red-500/20 flex flex-col items-center justify-center text-center">
              <p className="text-red-400 font-semibold text-lg mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-primary text-black font-semibold px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                Try Again
              </button>
            </div>
          </div>

          <PremiumAccessPopup
            open={showPremiumPopup}
            message={premiumMessage}
            onClose={() => setShowPremiumPopup(false)}
            onActivated={() => {
              setError(null);
              setLoading(true);
              setTimeout(() => {
                window.location.reload();
              }, 0);
            }}
          />
        </div>
      </PageLayout>
    );
  }

  if (!callDetails) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-background text-foreground py-20">
          <div className="max-w-7xl mx-auto px-6 pt-16">
            <div className="mb-8"><BackLink /></div>
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-muted-foreground text-lg">Call not found</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const durationMins = callDetails.endedAt && callDetails.startedAt
    ? Math.round((new Date(callDetails.endedAt).getTime() - new Date(callDetails.startedAt).getTime()) / 1000 / 60)
    : null;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground relative py-20 pb-40">
        {/* Ambient background */}
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#9d7df9] to-[#eca4ff] opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-16 space-y-8 relative z-10">
          {/* Header */}
          <div className="mb-2">
            <BackLink />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Call Details
              </h1>
              <p className="text-muted-foreground text-sm mt-1 font-mono">
                {callDetails.vapiCallId || callDetails.id}
              </p>
            </div>
            <Badge
              className={`font-medium tracking-wide border text-xs uppercase px-3 py-1.5 ${
                callDetails.status === 'ended'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
              }`}
            >
              {callDetails.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Call Information */}
              <div className="glass-card rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-foreground font-semibold text-xl">Call Information</h2>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Status', value: <Badge className={`text-xs uppercase ${callDetails.status === 'ended' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>{callDetails.status}</Badge> },
                    { label: 'Started At', value: new Date(callDetails.startedAt).toLocaleString() },
                    ...(callDetails.endedAt ? [{ label: 'Ended At', value: new Date(callDetails.endedAt).toLocaleString() }] : []),
                    { label: 'Duration', value: durationMins !== null ? `${durationMins} minutes` : 'In progress' },
                    { label: 'Messages', value: callDetails.messageCount || callDetails.messages?.length || 0 },
                    ...(callDetails.endedReason ? [{ label: 'Ended Reason', value: callDetails.endedReason }] : []),
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5">
                      <span className="text-muted-foreground text-sm font-medium">{row.label}</span>
                      <span className="text-foreground text-sm font-medium">{row.value as any}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audio Recordings */}
              {(callDetails.artifact?.recordingUrl ||
                callDetails.artifact?.stereoRecordingUrl ||
                callDetails.artifact?.recording?.mono?.combinedUrl) && (
                <div className="glass-card rounded-2xl p-6 border border-white/5">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                    <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-foreground font-semibold text-xl">Audio Recordings</h2>
                  </div>
                  <div className="space-y-4">
                    {(callDetails.artifact?.recordingUrl || callDetails.artifact?.recording?.mono?.combinedUrl) && (
                      <AudioPlayer
                        src={callDetails.artifact.recordingUrl || callDetails.artifact.recording?.mono?.combinedUrl!}
                        title="Combined Audio"
                        subtitle="Full conversation recording"
                      />
                    )}
                    {callDetails.artifact?.stereoRecordingUrl && (
                      <AudioPlayer
                        src={callDetails.artifact.stereoRecordingUrl}
                        title="Stereo Audio"
                        subtitle="High-quality stereo recording"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="h-full flex flex-col">
              {callDetails.emotionAnalysis && callDetails.emotionAnalysis.emotions.length > 0 && (
                <div className="glass-card rounded-2xl p-6 border border-white/5 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10 flex-shrink-0">
                    <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                      <Brain className="w-5 h-5 text-violet-400" />
                    </div>
                    <h2 className="text-foreground font-semibold text-xl">Emotion Analysis</h2>
                    <div className="ml-auto flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full">
                      <Activity className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-medium text-violet-400">
                        {callDetails.emotionAnalysis.emotions.length} readings
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow overflow-hidden flex flex-col">
                    <div className="flex-grow overflow-y-auto">
                      <EmotionVisualization
                        emotionAnalysis={callDetails.emotionAnalysis}
                        className="w-full min-h-0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages / Conversation */}
          {callDetails.messages && callDetails.messages.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-foreground font-semibold text-xl">
                  Conversation
                </h2>
                <span className="ml-auto text-xs text-muted-foreground font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {callDetails.messages.filter(m => m.role !== 'system' && m.message).length} messages
                </span>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {callDetails.messages
                  .filter(message => message.role !== 'system' && message.message)
                  .map((message, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-2xl border transition-all ${
                        message.role === 'bot' || message.role === 'assistant'
                          ? 'bg-white/3 border-white/5 mr-8'
                          : 'bg-primary/5 border-primary/10 ml-8'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            message.role === 'bot' || message.role === 'assistant'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}>
                            {message.role === 'bot' || message.role === 'assistant' ? 'AI Interviewer' : 'Candidate'}
                          </span>

                          {message.role === 'user' && message.emotionData && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs text-violet-400 font-medium capitalize">
                              {message.emotionData.emotion} · {Math.round(message.emotionData.confidence * 100)}%
                            </span>
                          )}
                        </div>

                        <span className="text-muted-foreground text-xs font-mono">
                          {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                          {message.secondsFromStart && ` +${message.secondsFromStart.toFixed(1)}s`}
                        </span>
                      </div>
                      <p className="text-foreground/90 leading-relaxed text-sm">{message.message}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI Interview Evaluation */}
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-foreground font-semibold text-xl">AI Evaluation</h2>
            </div>
            <InterviewEvaluation
              callId={callId}
              messages={callDetails.messages || []}
              callDetails={callDetails}
            />
          </div>

          {/* Cost Information */}
          {callDetails.cost && (
            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="p-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-foreground font-semibold text-xl">Cost Breakdown</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5">
                  <span className="text-muted-foreground text-sm font-medium">Total Cost</span>
                  <span className="text-green-400 font-bold text-lg">${callDetails.cost.toFixed(4)}</span>
                </div>
                {callDetails.costBreakdown && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {[
                      { label: 'LLM', val: callDetails.costBreakdown.llm },
                      { label: 'STT', val: callDetails.costBreakdown.stt },
                      { label: 'TTS', val: callDetails.costBreakdown.tts },
                      { label: 'Vapi', val: callDetails.costBreakdown.vapi },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col gap-1 p-3 bg-white/3 rounded-xl border border-white/5 text-center">
                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{item.label}</span>
                        <span className="text-foreground text-sm font-mono">${item.val?.toFixed(4) || '0.0000'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            setError(null);
            setLoading(true);
            setTimeout(() => {
              window.location.reload();
            }, 0);
          }}
        />
      </div>
    </PageLayout>
  );
}
