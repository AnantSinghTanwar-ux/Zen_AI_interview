"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";
import EmotionVisualization from "@/components/EmotionVisualization";
import InterviewEvaluation from "@/components/InterviewEvaluation";
import { EmotionData, emotionDetectionService } from "@/services/emotion/emotion-detection.service";
import { Activity, Brain, TrendingUp } from "lucide-react";

interface CallDetails {
  id: string;
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
        
        if (!response.ok) {
          throw new Error(`Failed to fetch call details: ${response.statusText}`);
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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link 
              href="/call-data"
              className="text-primary-200 hover:text-primary-100 transition-colors"
            >
              ← Back to Call Data
            </Link>
          </div>
          <h1 className="text-black text-black text-black text-3xl font-bold mb-8">Call Details</h1>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading call details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link 
              href="/call-data"
              className="text-primary-200 hover:text-primary-100 transition-colors"
            >
              ← Back to Call Data
            </Link>
          </div>
          <h1 className="text-black text-black text-black text-3xl font-bold mb-8">Call Details</h1>
          <div className="bg-[#f5f5f7] border border-red-500 rounded-2xl p-4">
            <p className="text-red-400">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!callDetails) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link 
              href="/call-data"
              className="text-primary-200 hover:text-primary-100 transition-colors"
            >
              ← Back to Call Data
            </Link>
          </div>
          <h1 className="text-black text-black text-black text-3xl font-bold mb-8">Call Details</h1>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Call not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/call-data"
            className="text-primary-200 hover:text-primary-100 transition-colors"
          >
            ← Back to Call Data
          </Link>
        </div>
        
        <div className="flex items-center justify-between">
          <h1 className="text-black text-black text-black text-3xl font-bold">Call Details</h1>
          <div className="text-sm text-gray-400">
            Call ID: <span className="font-mono">{callDetails.id}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Call Information */}
            <div className="bg-dark-200 border border-gray-600 rounded-2xl p-6">
              <h2 className="text-black text-black text-black text-xl font-semibold mb-4">Call Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-sm">Status</label>
                  <p className={`text-base font-medium capitalize ${
                    callDetails.status === 'ended' ? 'text-green-400' : 
                    callDetails.status === 'in-progress' ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {callDetails.status}
                  </p>
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Started At</label>
                  <p className="text-black text-sm">{new Date(callDetails.startedAt).toLocaleString()}</p>
                </div>
                {callDetails.endedAt && (
                  <div>
                    <label className="text-gray-400 text-sm">Ended At</label>
                    <p className="text-black text-sm">{new Date(callDetails.endedAt).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <label className="text-gray-400 text-sm">Duration</label>
                  <p className="text-black text-sm">
                    {callDetails.endedAt && callDetails.startedAt 
                      ? `${Math.round((new Date(callDetails.endedAt).getTime() - new Date(callDetails.startedAt).getTime()) / 1000 / 60)} minutes`
                      : 'In progress'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Messages</label>
                  <p className="text-black text-sm">{callDetails.messageCount || callDetails.messages?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Audio Recordings */}
            {(callDetails.artifact?.recordingUrl || 
              callDetails.artifact?.stereoRecordingUrl || 
              callDetails.artifact?.recording?.mono?.combinedUrl) && (
              <div className="bg-dark-200 border border-gray-600 rounded-2xl p-6">
                <h2 className="text-black text-black text-black text-xl font-semibold mb-4">Audio Recordings</h2>
                <div className="space-y-4">
                  {/* Combined Recording */}
                  {(callDetails.artifact?.recordingUrl || callDetails.artifact?.recording?.mono?.combinedUrl) && (
                    <AudioPlayer
                      src={callDetails.artifact.recordingUrl || callDetails.artifact.recording?.mono?.combinedUrl!}
                      title="Combined Audio"
                      subtitle="Full conversation recording"
                    />
                  )}
                  
                  {/* Stereo Recording */}
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
          <div>
            {/* Emotion Analysis */}
            {callDetails.emotionAnalysis && callDetails.emotionAnalysis.emotions.length > 0 && (
              <div className="bg-dark-200 border border-gray-600 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Brain className="w-6 h-6 text-purple-400" />
                  <h2 className="text-black text-black text-black text-xl font-semibold">Emotion Analysis</h2>
                  <div className="flex items-center gap-2 ml-auto">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-400">
                      {callDetails.emotionAnalysis.emotions.length} emotion readings
                    </span>
                  </div>
                </div>

                {/* Full Emotion Visualization */}
                <EmotionVisualization 
                  emotionAnalysis={callDetails.emotionAnalysis}
                  className="bg-gray-800"
                />
              </div>
            )}
          </div>
        </div>



      {/* Messages/Conversation */}
      {callDetails.messages && callDetails.messages.length > 0 && (
        <div className="bg-dark-200 border border-gray-600 rounded-2xl p-6">
          <h2 className="text-black text-black text-black text-xl font-semibold mb-4">
            Conversation ({callDetails.messages.length} messages)
          </h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {callDetails.messages
              .filter(message => message.role !== 'system')
              .map((message, index) => (
              <div key={index} className={`border-l-4 pl-4 py-3 ${
                message.role === 'bot' || message.role === 'assistant' 
                  ? 'border-primary-500 bg-[#f5f5f7]' 
                  : 'border-green-500 bg-[#f5f5f7]'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${
                      message.role === 'bot' || message.role === 'assistant' 
                        ? 'text-primary-200' 
                        : 'text-green-400'
                    }`}>
                      {message.role === 'bot' || message.role === 'assistant' ? 'AI Interviewer' : 'Candidate'}
                    </span>
                    
                    {/* Emotion indicator for user messages */}
                    {message.role === 'user' && message.emotionData && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-[#f5f5f7] rounded-full">
                        <span className="text-xs text-purple-300 capitalize">
                          {message.emotionData.emotion}
                        </span>
                        <span className="text-xs text-gray-400">
                          {Math.round(message.emotionData.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right text-xs text-gray-400">
                    {message.timestamp && (
                      <div>{new Date(message.timestamp).toLocaleTimeString()}</div>
                    )}
                    {message.secondsFromStart && (
                      <div>+{message.secondsFromStart.toFixed(1)}s</div>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 leading-relaxed">{message.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* AI Interview Evaluation */}
        <InterviewEvaluation 
          callId={callId}
          messages={callDetails.messages || []}
          callDetails={callDetails}
        />

        {/* Cost Information - Moved to Bottom */}
        {callDetails.cost && (
          <div className="bg-dark-200 border border-gray-600 rounded-2xl p-6">
            <h2 className="text-black text-black text-black text-xl font-semibold mb-4">Cost Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Cost</span>
                <span className="text-primary-200 font-semibold">${callDetails.cost.toFixed(4)}</span>
              </div>
              {callDetails.costBreakdown && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">LLM</span>
                    <span className="text-black">${callDetails.costBreakdown.llm?.toFixed(4) || '0.0000'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">STT (Speech-to-Text)</span>
                    <span className="text-black">${callDetails.costBreakdown.stt?.toFixed(4) || '0.0000'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TTS (Text-to-Speech)</span>
                    <span className="text-black">${callDetails.costBreakdown.tts?.toFixed(4) || '0.0000'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Vapi Platform</span>
                    <span className="text-black">${callDetails.costBreakdown.vapi?.toFixed(4) || '0.0000'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
