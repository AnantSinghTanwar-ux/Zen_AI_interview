"use client";

import React from 'react';
import { EmotionData, emotionDetectionService } from '@/services/emotion/emotion-detection.service';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmotionTimelineProps {
  emotions: EmotionData[];
  duration?: number; // Total call duration in seconds
  className?: string;
}

interface EmotionVisualizationProps {
  emotionAnalysis: {
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
  className?: string;
}

export function EmotionTimeline({ emotions, duration = 300, className }: EmotionTimelineProps) {
  if (emotions.length === 0) {
    return (
      <div className={cn("bg-gray-800 rounded-2xl p-4", className)}>
        <p className="text-gray-400 text-center">No emotion data available</p>
      </div>
    );
  }

  const maxTime = duration;
  const timeSegments = 10; // Divide timeline into 10 segments
  const segmentDuration = maxTime / timeSegments;

  // Group emotions by time segments
  const emotionsBySegment = Array.from({ length: timeSegments }, (_, i) => {
    const segmentStart = i * segmentDuration;
    const segmentEnd = (i + 1) * segmentDuration;
    
    return emotions.filter(emotion => {
      const emotionTime = emotion.secondsFromStart;
      return emotionTime >= segmentStart && emotionTime < segmentEnd;
    });
  });

  // Calculate dominant emotion for each segment
  const segmentEmotions = emotionsBySegment.map(segmentEmotions => {
    if (segmentEmotions.length === 0) return null;
    
    // Find most frequent emotion in segment
    const emotionCounts = segmentEmotions.reduce((acc, emotion) => {
      acc[emotion.emotion] = (acc[emotion.emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    const avgConfidence = segmentEmotions.reduce((sum, e) => sum + e.confidence, 0) / segmentEmotions.length;
    const avgStress = segmentEmotions.reduce((sum, e) => sum + (e.additionalMetrics?.stress_level || 0), 0) / segmentEmotions.length;
    
    return {
      emotion: dominantEmotion,
      confidence: avgConfidence,
      stressLevel: avgStress,
      count: segmentEmotions.length
    };
  });

  return (
    <div className={cn("bg-[#f5f5f7]  text-foreground p-2", className)}>
      <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
        <Activity className="w-5 h-5 text-black" />
        <h3 className="text-lg font-black text-black">Emotion Timeline</h3>
      </div>
      
      {/* Timeline visualization */}
      <div className="space-y-4">
        {/* Time markers */}
        <div className="flex justify-between text-xs font-bold text-gray-500 px-2 font-mono">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>
              {Math.round((i * maxTime) / 5)}s
            </span>
          ))}
        </div>
        
        {/* Emotion bars */}
        <div className="grid grid-cols-10 gap-1 h-20 bg-[#f5f5f7]  border border-none border border-black p-1">
          {segmentEmotions.map((segment, index) => {
            if (!segment) {
              return (
                <div
                  key={index}
                  className="bg-[#f5f5f7]  border-r border-gray-300 opacity-30"
                  title="No data"
                />
              );
            }
            
            const color = emotionDetectionService.getEmotionColor(segment.emotion as any);
            const height = Math.max(20, segment.confidence * 80); // 20% to 80% height based on confidence
            
            return (
              <div
                key={index}
                className="relative flex flex-col justify-end group cursor-pointer border-r border-dashed border-gray-300 last:border-0"
                title={`${segment.emotion} (${Math.round(segment.confidence * 100)}% confidence)`}
              >
                <div
                  className="w-full transition-all duration-200 hover:scale-110 hover:z-10"
                  style={{
                    backgroundColor: color,
                    height: `${height}%`,
                    opacity: 1
                  }}
                />
                
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <div className="bg-[#f5f5f7]  text-foreground border border-black shadow-sm text-black text-xs px-2 py-1 whitespace-nowrap">
                    <div className="font-bold capitalize border-b border-black mb-1">{segment.emotion}</div>
                    <div className="font-mono">Conf: {Math.round(segment.confidence * 100)}%</div>
                    <div className="font-mono">Stress: {Math.round(segment.stressLevel * 100)}%</div>
                  </div>
                </div>
                
                {/* Emotion label */}
                <div className="hidden group-hover:block absolute top-full left-0 right-0 text-[10px] text-center mt-1 text-black font-bold uppercase truncate bg-[#f5f5f7]  text-foreground border border-black z-20">
                  {segment.emotion}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Array.from(new Set(emotions.map(e => e.emotion))).map(emotion => (
            <div key={emotion} className="flex items-center gap-1 text-xs border border-gray-200 px-1 bg-[#f5f5f7]  border border-none">
              <div
                className="w-3 h-3"
                style={{ backgroundColor: emotionDetectionService.getEmotionColor(emotion) }}
              />
              <span className="text-black font-bold capitalize">{emotion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmotionVisualization({ emotionAnalysis, className }: EmotionVisualizationProps) {
  const { emotions, dominantEmotion, emotionalTrend, summary } = emotionAnalysis;
  
  const getTrendIcon = () => {
    switch (emotionalTrend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (emotionalTrend) {
      case 'improving':
        return 'text-green-400';
      case 'declining':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={cn("bg-[#f5f5f7]  text-foreground p-6 space-y-6", className)}>
      <div className="flex items-center gap-2 border-b-2 border-black pb-4">
        <Activity className="w-5 h-5 text-purple-700" />
        <h3 className="text-lg font-black text-black">Emotion Analysis</h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dominant Emotion */}
        <div className="bg-[#f5f5f7]  border border-none p-4 border border-black">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-4 h-4" 
              style={{backgroundColor: emotionDetectionService.getEmotionColor(dominantEmotion as any)}}
            ></div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase">Dominant</p>
              <p className="text-black font-black capitalize text-lg">{dominantEmotion}</p>
            </div>
          </div>
        </div>

        {/* Emotional Trend */}
        <div className="bg-[#f5f5f7]  border border-none p-4 border border-black">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon()}
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase">Trend</p>
              <p className={cn("font-black capitalize text-lg", getTrendColor())}>
                {emotionalTrend}
              </p>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div className="bg-[#f5f5f7]  border border-none p-4 border border-black">
          <p className="text-sm font-bold text-gray-500 uppercase mb-1">Avg Confidence</p>
          <p className="text-black font-black text-lg">
            {Math.round(summary.averageConfidence * 100)}%
          </p>
          <div className="w-full bg-[#f5f5f7]  h-2 mt-2">
            <div
              className="bg-blue-400 h-full transition-all duration-500"
              style={{ width: `${summary.averageConfidence * 100}%` }}
            />
          </div>
        </div>

        {/* Stability */}
        <div className="bg-[#f5f5f7]  border border-none p-4 border border-black">
          <p className="text-sm font-bold text-gray-500 uppercase mb-1">Stability</p>
          <p className="text-black font-black text-lg">
            {Math.round(summary.emotionalStability * 100)}%
          </p>
          <div className="w-full bg-[#f5f5f7]  h-2 mt-2">
            <div
              className={cn(
                "h-full transition-all duration-500",
                summary.emotionalStability > 0.7 ? "bg-green-400" :
                summary.emotionalStability > 0.4 ? "bg-yellow-400" : "bg-red-400"
              )}
              style={{ width: `${summary.emotionalStability * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Emotion Distribution */}
      <div className="space-y-4">
        <h4 className="text-black font-black text-xl border-b-2 border-black inline-block mt-4">Emotion Distribution</h4>
        <div className="space-y-3">
          {Object.entries(
            emotions.reduce((acc, emotion) => {
              acc[emotion.emotion] = (acc[emotion.emotion] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          )
            .sort(([,a], [,b]) => b - a)
            .map(([emotion, count]) => {
              const percentage = (count / emotions.length) * 100;
              return (
                <div key={emotion} className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 flex-shrink-0" 
                    style={{backgroundColor: emotionDetectionService.getEmotionColor(emotion as any)}}
                  ></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-black capitalize">{emotion}</span>
                      <span className="text-xs font-mono font-bold text-gray-500">
                        {count} times ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f5f5f7]  border border-none h-2">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          backgroundColor: emotionDetectionService.getEmotionColor(emotion as any),
                          width: `${percentage}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Stress Indicators */}
      {summary.stressIndicators.length > 0 && (
        <div className="space-y-3 bg-orange-50 p-4 border border-orange-200">
          <h4 className="text-black font-black flex items-center gap-2">
             <span className="w-2 h-2 bg-orange-500 block"></span>
             Stress Indicators
          </h4>
          <div className="space-y-1">
            {summary.stressIndicators.map((indicator, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-black font-medium">
                <div className="w-1 h-1 bg-black rounded-full" />
                {indicator}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <EmotionTimeline emotions={emotions} />
    </div>
  );
}

export default EmotionVisualization;
