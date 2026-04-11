"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";
import EmotionVisualization from "@/components/EmotionVisualization";
import InterviewEvaluation from "@/components/InterviewEvaluation";
import { EmotionData } from "@/services/emotion/emotion-detection.service";
import { Activity, Brain, TrendingUp, Clock, MessageSquare, DollarSign, ChevronLeft } from "lucide-react";
import PageLayout from "@/components/PageLayout";

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
      <PageLayout>
        <div className="min-h-screen bg-[#f5f5f7]  text-foreground font-sans">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-6">
              <Link 
                href="/call-data"
                className="inline-flex items-center gap-2 px-4 py-2 border border-none shadow-neo bg-[#f5f5f7]  text-foreground font-bold text-black"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Call Data
              </Link>
            </div>
            <h1 className="text-4xl font-black mb-8">Call Details</h1>
            <div className="flex items-center justify-center h-64 border border-none bg-[#f5f5f7]  text-foreground shadow-neo">
              <div className="text-xl font-bold">Loading call details...</div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-[#f5f5f7]  text-foreground font-sans">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-6">
              <Link 
                href="/call-data"
                className="inline-flex items-center gap-2 px-4 py-2 border border-none shadow-neo bg-[#f5f5f7]  text-foreground font-bold text-black"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Call Data
              </Link>
            </div>
            <h1 className="text-4xl font-black mb-8">Call Details</h1>
            <div className="bg-[#f5f5f7]  border border-none shadow-neo p-6">
              <p className="text-white font-bold text-lg">Error: {error}</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!callDetails) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-[#f5f5f7]  text-foreground font-sans">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-6">
              <Link 
                href="/call-data"
                className="inline-flex items-center gap-2 px-4 py-2 border border-none shadow-neo bg-[#f5f5f7]  text-foreground font-bold text-black"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Call Data
              </Link>
            </div>
            <h1 className="text-4xl font-black mb-8">Call Details</h1>
            <div className="text-center py-12 border border-none bg-[#f5f5f7]  border border-none shadow-neo">
              <p className="text-black font-bold text-lg">Call not found</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-[#f5f5f7]  text-foreground font-sans">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div className="mb-6">
            <Link 
              href="/call-data"
              className="inline-flex items-center gap-2 px-4 py-2 border border-none shadow-neo bg-[#f5f5f7]  text-foreground font-bold text-black"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Call Data
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-4xl font-black text-black">Call Details</h1>
            <div className="flex items-center gap-2 bg-[#f5f5f7]  border border-none px-4 py-2 shadow-neo">
              <span className="font-bold">ID:</span>
              <span className="font-mono text-sm">{callDetails.id}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Call Information */}
              <div className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo p-6">
                <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4">
                  <Clock className="w-6 h-6" />
                  <h2 className="text-2xl font-black">Call Information</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                    <span className="font-bold text-gray-600">Status</span>
                    <span className={`px-3 py-1 border border-none text-sm font-bold shadow-neo uppercase ${
                      callDetails.status === 'ended' ? 'bg-[#4ADE80] text-black' : 
                      callDetails.status === 'in-progress' ? 'bg-[#60A5FA] text-black' : 'bg-[#f5f5f7]  text-black'
                    }`}>
                      {callDetails.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                    <span className="font-bold text-gray-600">Started At</span>
                    <span className="font-medium">{new Date(callDetails.startedAt).toLocaleString()}</span>
                  </div>
                  
                  {callDetails.endedAt && (
                    <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                      <span className="font-bold text-gray-600">Ended At</span>
                      <span className="font-medium">{new Date(callDetails.endedAt).toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                    <span className="font-bold text-gray-600">Duration</span>
                    <span className="font-medium">
                      {callDetails.endedAt && callDetails.startedAt 
                        ? `${Math.round((new Date(callDetails.endedAt).getTime() - new Date(callDetails.startedAt).getTime()) / 1000 / 60)} minutes`
                        : 'In progress'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                    <span className="font-bold text-gray-600">Messages</span>
                    <span className="font-medium">{callDetails.messageCount || callDetails.messages?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Audio Recordings */}
              {(callDetails.artifact?.recordingUrl || 
                callDetails.artifact?.stereoRecordingUrl || 
                callDetails.artifact?.recording?.mono?.combinedUrl) && (
                <div className="bg-[#f5f5f7]  border border-none shadow-neo p-6">
                  <h2 className="text-2xl font-black mb-6 border-b-2 border-black pb-4">Audio Recordings</h2>
                  <div className="space-y-6">
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
            <div className="h-full flex flex-col">
              {/* Emotion Analysis */}
              {callDetails.emotionAnalysis && callDetails.emotionAnalysis.emotions.length > 0 && (
                <div className="bg-[#f5f5f7]  border border-none shadow-neo p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4 flex-shrink-0">
                    <Brain className="w-6 h-6 text-purple-700" />
                    <h2 className="text-2xl font-black text-purple-900">Emotion Analysis</h2>
                    <div className="flex items-center gap-2 ml-auto bg-purple-200 border border-none px-3 py-1 shadow-neo">
                      <Activity className="w-4 h-4 text-purple-900" />
                      <span className="text-sm font-bold text-purple-900">
                        {callDetails.emotionAnalysis.emotions.length} readings
                      </span>
                    </div>
                  </div>

                  {/* Full Emotion Visualization */}
                  <div className="border border-none bg-[#f5f5f7]  text-foreground shadow-neo flex-grow overflow-hidden flex flex-col">
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



        {/* Messages/Conversation */}
        {callDetails.messages && callDetails.messages.length > 0 && (
          <div className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo p-6">
            <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4">
              <MessageSquare className="w-6 h-6" />
              <h2 className="text-2xl font-black">
                Conversation ({callDetails.messages.length} messages)
              </h2>
            </div>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
              {callDetails.messages
                .filter(message => message.role !== 'system')
                .map((message, index) => (
                <div key={index} className={`border border-none p-4 shadow-neo ${
                  message.role === 'bot' || message.role === 'assistant' 
                    ? 'bg-[#f5f5f7]  ml-0 mr-8' 
                    : 'bg-green-50 ml-8 mr-0'
                }`}>
                  <div className="flex justify-between items-start mb-3 border-b-2 border-gray-200 pb-2">
                    <div className="flex items-center gap-3">
                      <span className={`font-black text-sm uppercase px-2 py-0.5 border border-none ${
                        message.role === 'bot' || message.role === 'assistant' 
                          ? 'bg-blue-200 text-black' 
                          : 'bg-green-200 text-black'
                      }`}>
                        {message.role === 'bot' || message.role === 'assistant' ? 'AI Interviewer' : 'Candidate'}
                      </span>
                      
                      {/* Emotion indicator for user messages */}
                      {message.role === 'user' && message.emotionData && (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-purple-100 border border-none rounded-full text-xs">
                          <span className="font-bold text-purple-900 capitalize">
                            {message.emotionData.emotion}
                          </span>
                          <span className="font-mono text-purple-700">
                            {Math.round(message.emotionData.confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right text-xs font-mono font-bold text-gray-500">
                      {message.timestamp && (
                        <span className="mr-2">{new Date(message.timestamp).toLocaleTimeString()}</span>
                      )}
                      {message.secondsFromStart && (
                        <span>+{message.secondsFromStart.toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                  <p className="text-black leading-relaxed font-medium">{message.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

          {/* AI Interview Evaluation */}
          <div className="bg-[#f5f5f7]  border border-none shadow-neo p-6">
             <InterviewEvaluation 
              callId={callId}
              messages={callDetails.messages || []}
              callDetails={callDetails}
            />
          </div>

          {/* Cost Information - Moved to Bottom */}
          {callDetails.cost && (
            <div className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo p-6">
              <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4">
                <DollarSign className="w-6 h-6 text-green-700" />
                <h2 className="text-2xl font-black">Cost Breakdown</h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#f5f5f7]  border border-none border border-none">
                  <span className="font-bold text-gray-600">Total Cost</span>
                  <span className="text-green-700 font-black text-xl">${callDetails.cost.toFixed(4)}</span>
                </div>
                {callDetails.costBreakdown && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex justify-between items-center p-3 border border-none border-dashed">
                      <span className="font-bold text-gray-500">LLM</span>
                      <span className="font-mono font-bold">${callDetails.costBreakdown.llm?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-none border-dashed">
                      <span className="font-bold text-gray-500">STT (Speech-to-Text)</span>
                      <span className="font-mono font-bold">${callDetails.costBreakdown.stt?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-none border-dashed">
                      <span className="font-bold text-gray-500">TTS (Text-to-Speech)</span>
                      <span className="font-mono font-bold">${callDetails.costBreakdown.tts?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border border-none border-dashed">
                      <span className="font-bold text-gray-500">Vapi Platform</span>
                      <span className="font-mono font-bold">${callDetails.costBreakdown.vapi?.toFixed(4) || '0.0000'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
