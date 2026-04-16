"use client";

import React from "react";
import { useCallLogs } from "@/hooks/useCallLogs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Phone, DollarSign, MessageCircle } from "lucide-react";

interface CallLogsProps {
  userId: string;
}

export function CallLogs({ userId }: CallLogsProps) {
  const { callLogs, loading, error } = useCallLogs(userId);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#EAEAF0]">Call History</h2>
        <div className="grid gap-4">
           {[1, 2, 3].map((i) => (
             <Card key={i} className="neo-box p-6 border-none">
                <div className="flex items-start justify-between">
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                         <Skeleton className="h-5 w-5 rounded-full bg-[#1F1F2B]" />
                         <Skeleton className="h-4 w-32 bg-[#1F1F2B]" />
                         <Skeleton className="h-5 w-20 rounded-full bg-[#1F1F2B]" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Skeleton className="h-4 w-24 bg-[#1F1F2B]" />
                          <Skeleton className="h-4 w-24 bg-[#1F1F2B]" />
                          <Skeleton className="h-4 w-24 bg-[#1F1F2B]" />
                      </div>
                   </div>
                </div>
             </Card>
           ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-[#111118] rounded-2xl border border-red-900/50">
        <p className="text-red-400 font-medium">Error loading call logs: {error}</p>
      </div>
    );
  }

  if (callLogs.length === 0) {
    return (
      <div className="text-center py-16 px-6 border border-dashed border-[#1F1F2B] rounded-2xl bg-[#0B0B0F]">
        <div className="bg-[#111118] h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#1F1F2B]">
          <Phone className="h-6 w-6 text-[#9CA3AF]" />
        </div>
        <h3 className="text-xl font-semibold text-[#EAEAF0] mb-2">No call history</h3>
        <p className="text-[#9CA3AF] max-w-sm mx-auto">
          Start a new interview session to see your past logs, performance metrics, and actionable feedback here.
        </p>
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "ended":
        return "bg-[#111118] text-[#FACC15] border-[#FACC15]/30";
      case "active":
        return "bg-[#111118] text-[#A855F7] border-[#A855F7]/30";
      case "failed":
        return "bg-[#111118] text-red-500 border-red-500/30";
      default:
        return "bg-[#111118] text-[#9CA3AF] border-[#1F1F2B]";
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-[#EAEAF0]">Session Logs</h2>

      <div className="grid gap-4">
        {callLogs.map((callLog) => (
          <div key={callLog.id} className="neo-box p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-[#1A1A24] p-2 rounded-full border border-[#1F1F2B]">
                  <Phone className="h-4 w-4 text-[#FACC15]" />
                </div>
                <span className="text-base font-medium text-[#EAEAF0]">
                  {formatDate(callLog.startedAt)}
                </span>
                <Badge variant="outline" className={`ml-2 px-3 py-0.5 rounded-full font-medium ${getStatusStyle(callLog.status)}`}>
                  {callLog.status}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                {callLog.hasRecording && (
                  <Badge variant="outline" className="bg-[#1A1A24] text-[#9CA3AF] border-[#1F1F2B] font-medium rounded-full">
                    Recording
                  </Badge>
                )}
                {callLog.hasTranscript && (
                  <Badge variant="outline" className="bg-[#1A1A24] text-[#9CA3AF] border-[#1F1F2B] font-medium rounded-full">
                    Transcript
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4 border-y border-[#1F1F2B]">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-[#9CA3AF]" />
                <span className="text-sm font-medium text-[#EAEAF0]">
                  {formatDuration(callLog.duration)}
                </span>
              </div>

              {callLog.cost !== undefined && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-[#9CA3AF]" />
                  <span className="text-sm font-medium text-[#EAEAF0]">
                    ${callLog.cost.toFixed(4)}
                  </span>
                </div>
              )}

              {callLog.messageCount !== undefined && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-[#9CA3AF]" />
                  <span className="text-sm font-medium text-[#EAEAF0]">
                    {callLog.messageCount} messages
                  </span>
                </div>
              )}
            </div>

            {callLog.summary && (
              <div className="mt-5 bg-[#1A1A24] p-4 rounded-xl border border-[#1F1F2B]">
                <p className="text-sm text-[#9CA3AF] leading-relaxed">
                  {callLog.summary}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
