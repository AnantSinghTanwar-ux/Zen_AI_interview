"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCallData } from '@/hooks/useCallData';
import { SavedCallData } from '@/types/vapi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Play, Trash2, RefreshCw, MessageSquare, Clock } from 'lucide-react';

interface CallDataManagerProps {
  userId?: string;
  assistantId?: string;
}

export function CallDataManager({ userId, assistantId }: CallDataManagerProps) {
  const router = useRouter();
  const {
    loading,
    error,
    callData,
    fetchCallData,
    deleteCall,
    syncRecentCalls,
    clearError,
  } = useCallData();

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Initially fetch all calls without any filters to avoid index issues
    fetchCallData();
  }, [fetchCallData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncRecentCalls({ userId, assistantId, limit: 10 });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this call data?')) {
      await deleteCall(id);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCost = (cost?: number) => {
    if (!cost) return 'N/A';
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Call Data Manager</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchCallData({ userId, assistantId })}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing || loading}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Recent
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-[#f5f5f7] border border-red-500 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400">{error}</span>
            <Button onClick={clearError} variant="ghost" size="sm">
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {callData.length === 0 && !loading ? (
          <div className="text-center py-8 text-light-100">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No call data found. Start an interview to see calls here.</p>
            <Button onClick={handleSync} className="mt-4" size="sm">
              Sync Recent Calls
            </Button>
          </div>
        ) : (
          callData.map((call: SavedCallData) => (
            <Card key={call.id} className="bg-dark-200 border-light-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Call {call.vapiCallId.slice(-8)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={call.status === 'ended' ? 'secondary' : 'default'}>
                      {call.status}
                    </Badge>
                    <Button
                      onClick={() => handleDelete(call.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-light-100 space-y-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(call.duration)}
                    </span>
                    <span>Cost: {formatCost(call.cost)}</span>
                    <span>Messages: {call.messages?.length || 0}</span>
                  </div>
                  <div className="text-xs text-light-400">
                    Started: {new Date(call.startedAt).toLocaleString()}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {call.transcript && (
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Transcript</h4>
                      <div className="bg-dark-300 rounded p-3 text-sm text-light-100 max-h-32 overflow-y-auto">
                        {call.transcript.slice(0, 200)}
                        {call.transcript.length > 200 && '...'}
                      </div>
                    </div>
                  )}

                  {call.summary && (
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Summary</h4>
                      <div className="bg-dark-300 rounded p-3 text-sm text-light-100">
                        {call.summary}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {call.recordingUrl && (
                      <Button
                        onClick={() => window.open(call.recordingUrl, '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Recording
                      </Button>
                    )}
                    
                    {call.transcriptUrl && (
                      <Button
                        onClick={() => window.open(call.transcriptUrl, '_blank')}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Full Transcript
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => router.push(`/call-data/${call.id}`)}
                      variant="ghost"
                      size="sm"
                    >
                      Show Details
                    </Button>

                    <Button
                      onClick={() => router.push(`/feedback?callId=${call.vapiCallId}`)}
                      variant="outline"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      View Feedback
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {loading && (
        <div className="text-center py-4">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-200" />
          <p className="text-light-100 mt-2">Loading call data...</p>
        </div>
      )}
    </div>
  );
}
