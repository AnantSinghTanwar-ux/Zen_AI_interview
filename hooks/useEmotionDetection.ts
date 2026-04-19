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
  debounceMs = 2000 // Reduced to 2 seconds for responsive OpenRouter-backed analysis
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

  const buildLocalAnalysis = useCallback((history: EmotionData[]): EmotionAnalysisResult => {
    if (history.length === 0) {
      return {
        emotions: [],
        dominantEmotion: 'neutral',
        emotionalTrend: 'stable',
        summary: {
          averageConfidence: 0,
          mostFrequentEmotion: 'neutral',
          emotionalStability: 0,
          stressIndicators: [],
        },
      };
    }

    const counts = history.reduce((acc, item) => {
      acc[item.emotion] = (acc[item.emotion] || 0) + 1;
      return acc;
    }, {} as Record<EmotionData['emotion'], number>);

    const mostFrequentEmotion = (Object.entries(counts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral') as EmotionData['emotion'];

    const averageConfidence = history.reduce((sum, item) => sum + item.confidence, 0) / history.length;
    const averageStress = history.reduce((sum, item) => sum + (item.additionalMetrics?.stress_level || 0), 0) / history.length;
    const uniqueEmotions = new Set(history.map((item) => item.emotion)).size;
    const emotionalStability = Math.max(0, 1 - (uniqueEmotions / history.length));

    const stressIndicators: string[] = [];
    if (averageStress > 0.6) {
      stressIndicators.push('Elevated stress levels detected during responses.');
    }
    if (emotionalStability < 0.5) {
      stressIndicators.push('High emotional volatility detected across responses.');
    }

    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, Math.max(midpoint, 1));
    const secondHalf = history.slice(Math.max(midpoint, 1));
    const positiveSet = new Set<EmotionData['emotion']>(['happy', 'confident', 'excited', 'calm']);

    const firstHalfPositive = firstHalf.filter((item) => positiveSet.has(item.emotion)).length / firstHalf.length;
    const secondHalfPositive = secondHalf.length
      ? secondHalf.filter((item) => positiveSet.has(item.emotion)).length / secondHalf.length
      : firstHalfPositive;

    const delta = secondHalfPositive - firstHalfPositive;
    const emotionalTrend: EmotionAnalysisResult['emotionalTrend'] =
      delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'stable';

    return {
      emotions: history,
      dominantEmotion: mostFrequentEmotion,
      emotionalTrend,
      summary: {
        averageConfidence,
        mostFrequentEmotion,
        emotionalStability,
        stressIndicators,
      },
    };
  }, []);

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

  // Keep real-time analysis local to avoid network churn during active calls.
  useEffect(() => {
    setEmotionAnalysis(buildLocalAnalysis(emotionHistory));
  }, [emotionHistory, buildLocalAnalysis]);

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
