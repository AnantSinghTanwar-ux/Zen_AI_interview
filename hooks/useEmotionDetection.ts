import { useState, useEffect, useCallback, useRef } from 'react';
import { EmotionData, EmotionAnalysisResult, emotionDetectionService } from '@/services/emotion/emotion-detection.service';

interface UseEmotionDetectionProps {
  callId?: string;
  enableRealTime?: boolean;
  debounceMs?: number; // Add debounce option
}

interface UseEmotionDetectionReturn {
  currentEmotion: EmotionData | null;
  emotionHistory: EmotionData[];
  emotionAnalysis: EmotionAnalysisResult | null;
  isProcessing: boolean;
  error: string | null;
  addEmotionReading: (text: string, timestamp?: number) => Promise<void>;
  processCompleteTranscript: (messages: any[]) => Promise<void>;
  clearEmotions: () => void;
  toggleRealTimeDetection: () => void;
}

export function useEmotionDetection({
  callId,
  enableRealTime = true,
  debounceMs = 2000 // Reduced to 2 seconds for Gemini 2.5 Flash's better rate limits
}: UseEmotionDetectionProps = {}): UseEmotionDetectionReturn {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionData[]>([]);
  const [emotionAnalysis, setEmotionAnalysis] = useState<EmotionAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realTimeEnabled, setRealTimeEnabled] = useState(enableRealTime);
  
  // Debounce references
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedTextRef = useRef<string>('');

  // Add a new emotion reading with debouncing
  const addEmotionReading = useCallback(async (text: string, timestamp?: number) => {
    if (!realTimeEnabled || text.trim().length < 10) return;
    
    // Skip if text is very similar to the last processed text
    const normalizedText = text.trim().toLowerCase();
    if (normalizedText === lastProcessedTextRef.current) {
      return;
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      lastProcessedTextRef.current = normalizedText;
      
      setIsProcessing(true);
      setError(null);
      
      try {
        const emotionData = await emotionDetectionService.analyzeTextEmotion(
          text,
          timestamp || Date.now(),
          2000 // Default speaking duration
        );
        
        setCurrentEmotion(emotionData);
        setEmotionHistory(prev => [...prev, emotionData]);
        
        // Send to backend if we have a call ID
        if (callId) {
          try {
            await fetch(`/api/vapi/call-data/${callId}/emotion`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                transcript: text,
                timestamp: timestamp || Date.now(),
                isPartial: false
              }),
            });
          } catch (apiError) {
            console.warn('Failed to send emotion data to backend:', apiError);
            // Don't throw - continue with local processing
          }
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process emotion';
        setError(errorMessage);
        console.error('Error processing emotion:', err);
      } finally {
        setIsProcessing(false);
      }
    }, debounceMs);
  }, [callId, realTimeEnabled, debounceMs]);

  // Process a complete transcript for analysis
  const processCompleteTranscript = useCallback(async (messages: any[]) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const analysis = await emotionDetectionService.analyzeCompleteTranscript(messages);
      setEmotionAnalysis(analysis);
      setEmotionHistory(analysis.emotions);
      
      // Set the most recent emotion as current
      if (analysis.emotions.length > 0) {
        setCurrentEmotion(analysis.emotions[analysis.emotions.length - 1]);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze transcript';
      setError(errorMessage);
      console.error('Error analyzing transcript:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Clear all emotion data
  const clearEmotions = useCallback(() => {
    setCurrentEmotion(null);
    setEmotionHistory([]);
    setEmotionAnalysis(null);
    setError(null);
  }, []);

  // Toggle real-time detection
  const toggleRealTimeDetection = useCallback(() => {
    setRealTimeEnabled(prev => !prev);
  }, []);

  // Auto-update analysis when emotion history changes
  useEffect(() => {
    if (emotionHistory.length > 0) {
      // Create a mock analysis result for real-time updates
      const mockMessages = emotionHistory.map((emotion, index) => ({
        role: 'user',
        message: `Emotion reading ${index + 1}`,
        time: emotion.timestamp,
        secondsFromStart: emotion.secondsFromStart
      }));
      
      // Debounce the analysis update
      const timer = setTimeout(async () => {
        try {
          const analysis = await emotionDetectionService.analyzeCompleteTranscript(mockMessages);
          setEmotionAnalysis(analysis);
        } catch (err) {
          console.warn('Failed to update emotion analysis:', err);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [emotionHistory]);

  return {
    currentEmotion,
    emotionHistory,
    emotionAnalysis,
    isProcessing,
    error,
    addEmotionReading,
    processCompleteTranscript,
    clearEmotions,
    toggleRealTimeDetection: toggleRealTimeDetection
  };
}

// Hook for fetching emotion data for a specific call
export function useCallEmotionData(callId: string) {
  const [emotionData, setEmotionData] = useState<{
    emotions: EmotionData[];
    analysis: EmotionAnalysisResult | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;

    const fetchEmotionData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/vapi/call-data/${callId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch call data: ${response.statusText}`);
        }
        
        const callData = await response.json();
        
        if (callData.emotionAnalysis) {
          setEmotionData({
            emotions: callData.emotionAnalysis.emotions || [],
            analysis: callData.emotionAnalysis
          });
        } else {
          // No emotion data available
          setEmotionData({
            emotions: [],
            analysis: null
          });
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch emotion data';
        setError(errorMessage);
        console.error('Error fetching emotion data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmotionData();
  }, [callId]);

  return {
    emotionData,
    isLoading,
    error,
    refetch: () => {
      if (callId) {
        setIsLoading(true);
        // Re-trigger the effect
        setEmotionData(null);
      }
    }
  };
}

export default useEmotionDetection;
