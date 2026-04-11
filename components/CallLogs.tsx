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
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-black">Call History</h2>
        <div className="grid gap-4">
           {[1, 2, 3].map((i) => (
             <Card key={i} className="p-6 bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
                <div className="flex items-start justify-between">
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                         <Skeleton className="h-5 w-5 rounded-full bg-[#f5f5f7] " />
                         <Skeleton className="h-4 w-32 bg-[#f5f5f7] " />
                         <Skeleton className="h-5 w-20 rounded-full bg-[#f5f5f7] " />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Skeleton className="h-4 w-24 bg-[#f5f5f7] " />
                          <Skeleton className="h-4 w-24 bg-[#f5f5f7] " />
                          <Skeleton className="h-4 w-24 bg-[#f5f5f7] " />
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
      <div className="text-center p-8 bg-[#f5f5f7]  rounded-3xl border-2 border-red-600 shadow-neo">
        <p className="text-red-700 font-bold">Error loading call logs: {error}</p>
      </div>
    );
  }

  if (callLogs.length === 0) {
    return (
      <div className="text-center p-8 border-2 border-dashed border-gray-400 rounded-3xl bg-[#f5f5f7]  border border-none">
        <Phone className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-black text-black">No call logs</h3>
        <p className="mt-1 text-gray-600 font-medium">
          Start a call to see your call history here.
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "ended":
        return "bg-green-100 text-green-700 border-green-700 border-2 font-bold";
      case "active":
        return "bg-blue-100 text-blue-700 border-blue-700 border-2 font-bold";
      case "failed":
        return "bg-red-100 text-red-700 border-red-700 border-2 font-bold";
      default:
        return "bg-[#f5f5f7]  border border-none text-gray-700 border-gray-700 border-2 font-bold";
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black text-black">Call History</h2>

      <div className="grid gap-4">
        {callLogs.map((callLog) => (
          <Card key={callLog.id} className="p-6 bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="h-5 w-5 text-gray-600" />
                  <span className="text-sm text-gray-600 font-bold">
                    {formatDate(callLog.startedAt)}
                  </span>
                  <Badge variant="outline" className={getStatusColor(callLog.status)}>
                    {callLog.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 font-medium">
                      {formatDuration(callLog.duration)}
                    </span>
                  </div>

                  {callLog.cost && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600 font-medium">
                        ${callLog.cost.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {callLog.messageCount !== undefined && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600 font-medium">
                        {callLog.messageCount} messages
                      </span>
                    </div>
                  )}

                  <div className="flex gap-1">
                    {callLog.hasRecording && (
                      <Badge variant="outline" className="text-xs border-2 border-gray-300 text-gray-600 font-bold">
                        Recording
                      </Badge>
                    )}
                    {callLog.hasTranscript && (
                      <Badge variant="outline" className="text-xs border-2 border-gray-300 text-gray-600 font-bold">
                        Transcript
                      </Badge>
                    )}
                  </div>
                </div>

                {callLog.summary && (
                  <div className="mt-3 p-3 bg-[#f5f5f7]  border border-none border-2 border-gray-200 rounded-2xl">
                    <p className="text-sm text-gray-800 line-clamp-2 font-medium">
                      {callLog.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
