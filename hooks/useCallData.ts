"use client";

import { useState, useCallback } from 'react';
import { SavedCallData } from '@/types/vapi';

interface UseCallDataOptions {
  userId?: string;
  assistantId?: string;
  limit?: number;
}

interface UseCallDataReturn {
  loading: boolean;
  error: string | null;
  callData: SavedCallData[];
  fetchCallData: (options?: UseCallDataOptions) => Promise<void>;
  deleteCall: (id: string) => Promise<void>;
  syncRecentCalls: (options?: UseCallDataOptions) => Promise<void>;
  clearError: () => void;
}

export function useCallData(): UseCallDataReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callData, setCallData] = useState<SavedCallData[]>([]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchCallData = useCallback(async (options: UseCallDataOptions = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch call data from the API
      const queryParams = new URLSearchParams();
      if (options.limit) queryParams.append('limit', options.limit.toString());
      if (options.userId) queryParams.append('userId', options.userId);
      if (options.assistantId) queryParams.append('assistantId', options.assistantId);

      const response = await fetch(`/api/vapi/call-data?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch call data: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform the data to match SavedCallData structure
      const transformedData: SavedCallData[] = data.map((call: any) => ({
        id: call.id,
        vapiCallId: call.id,
        userId: options.userId,
        assistantId: options.assistantId,
        status: call.status,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        duration: call.endedAt && call.startedAt 
          ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
          : undefined,
        cost: call.cost,
        costBreakdown: call.costBreakdown,
        messages: call.messages,
        transcript: call.messages?.filter((msg: any) => msg.type === 'transcript')
          .map((msg: any) => msg.transcript)
          .join(' '),
        summary: '', // Could be generated from transcript
        recordingUrl: call.recordingUrl,
        transcriptUrl: call.transcriptUrl,
        createdAt: call.startedAt,
        updatedAt: call.endedAt
      }));

      setCallData(transformedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch call data';
      setError(errorMessage);
      console.error('Error fetching call data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCall = useCallback(async (id: string) => {
    try {
      setError(null);
      
      // For now, just remove from local state
      // You can implement API deletion later
      setCallData(prev => prev.filter(call => call.id !== id));
      
      console.log(`Call ${id} removed from local state`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete call';
      setError(errorMessage);
      console.error('Error deleting call:', err);
    }
  }, []);

  const syncRecentCalls = useCallback(async (options: UseCallDataOptions = {}) => {
    // For now, this is the same as fetchCallData
    // You can enhance this to specifically sync with external APIs
    await fetchCallData({ ...options, limit: options.limit || 10 });
  }, [fetchCallData]);

  return {
    loading,
    error,
    callData,
    fetchCallData,
    deleteCall,
    syncRecentCalls,
    clearError,
  };
}