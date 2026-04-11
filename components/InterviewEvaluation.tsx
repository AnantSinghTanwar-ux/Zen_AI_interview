"use client";

import React, { useState } from 'react';
import { InterviewEvaluation, AspectRating, EvaluationResponse } from '@/types';
import { Brain, TrendingUp, CheckCircle, XCircle, AlertCircle, Loader2, Star } from 'lucide-react';

interface InterviewEvaluationProps {
  callId: string;
  messages: any[];
  callDetails: any;
  className?: string;
}

export default function InterviewEvaluationComponent({ 
  callId, 
  messages, 
  callDetails, 
  className = "" 
}: InterviewEvaluationProps) {
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!messages || messages.length === 0) {
      setError('No conversation found to evaluate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vapi/call-data/${callId}/evaluation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          callDetails
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 503) {
          throw new Error('Interview evaluation service is not available. Please configure the Google AI API key.');
        }
        
        if (response.status === 429) {
          throw new Error('API quota exceeded. Please try again in a few minutes or upgrade your Google AI plan.');
        }
        
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your Google AI API key configuration.');
        }
        
        throw new Error(errorData.details || errorData.error || 'Failed to evaluate interview');
      }

      const data: EvaluationResponse = await response.json();
      setEvaluation(data.evaluation);
    } catch (err) {
      console.error('Error evaluating interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to evaluate interview');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6.5) return 'text-yellow-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6.5) return 'bg-yellow-500';
    if (score >= 4) return 'bg-orange-500';
    return 'bg-[#f5f5f7] 0';
  };

  const getRecommendationColor = (recommendation: string): string => {
    switch (recommendation) {
      case 'Strong Hire': return 'bg-[#4ADE80] text-black border-black';
      case 'Hire': return 'bg-[#60A5FA] text-black border-black';
      case 'No Hire': return 'bg-[#FB923C] text-black border-black';
      case 'Strong No Hire': return 'bg-[#EF4444] text-white border-black';
      default: return 'bg-[#f5f5f7]  text-black border-black';
    }
  };

  const renderAspectRating = (name: string, aspect: AspectRating) => (
    <div key={name} className="bg-[#f5f5f7]  text-foreground border border-none p-4 shadow-neo">
      <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-2">
        <h4 className="text-black font-black capitalize text-lg">
          {name.replace(/([A-Z])/g, ' $1').trim()}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-black ${
            aspect.score >= 8 ? 'text-green-600' :
            aspect.score >= 6.5 ? 'text-yellow-600' :
            aspect.score >= 4 ? 'text-orange-600' : 'text-red-600'
          }`}>
            {aspect.score.toFixed(1)}
          </span>
          <div className="w-16 h-3 bg-[#f5f5f7]  border border-none border border-none p-0.5">
            <div 
              className={`h-full border-r border-black transition-all duration-300 ${getScoreBgColor(aspect.score)}`}
              style={{ width: `${(aspect.score / 10) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      <p className="text-black text-sm font-medium mb-3">{aspect.feedback}</p>
      
      {aspect.evidence.length > 0 && (
        <div className="bg-[#f5f5f7]  border border-none border border-black p-2 mt-2">
          <p className="text-black font-bold text-xs uppercase mb-2">Evidence:</p>
          <ul className="space-y-1">
            {aspect.evidence.map((evidence, idx) => (
              <li key={idx} className="text-gray-700 text-xs flex items-start gap-2 font-mono">
                <CheckCircle className="w-3 h-3 text-black mt-0.5 flex-shrink-0" />
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-[#f5f5f7]  text-foreground border border-none p-6 shadow-neo ${className}`}>
      <div className="flex items-center gap-3 mb-6 border-b-2 border-black pb-4">
        <Brain className="w-6 h-6 text-purple-700" />
        <h2 className="text-2xl font-black text-black">AI Interview Evaluation</h2>
        {evaluation && (
          <div className="flex items-center gap-1 ml-auto bg-yellow-100 border border-none px-2 py-1 shadow-neo">
            <Star className="w-4 h-4 text-black fill-yellow-400" />
            <span className="text-xs font-bold text-black border-l border-black pl-2 ml-1">Gemini AI</span>
          </div>
        )}
      </div>

      {!evaluation && !loading && (
        <div className="text-center py-8 bg-[#f5f5f7]  border border-none border border-none border-dashed">
          <Brain className="w-12 h-12 text-purple-700 mx-auto mb-4" />
          <p className="text-black font-medium mb-6 text-lg">
            Get AI-powered evaluation of this interview performance
          </p>
          <button
            onClick={handleEvaluate}
            disabled={loading || !messages || messages.length === 0}
            className="bg-[#A3E635] hover:bg-[#bef264] disabled:bg-gray-300 disabled:cursor-not-allowed text-black border border-none px-8 py-3 font-black uppercase tracking-wide shadow-neo"
          >
            Evaluate Interview
          </button>
          {(!messages || messages.length === 0) && (
            <p className="text-red-600 font-bold text-sm mt-4 bg-red-100 border-2 border-red-500 inline-block px-4 py-1">No conversation found to evaluate</p>
          )}
          <div className="mt-6 text-xs text-gray-500 font-mono">
            <p>Powered by Google Gemini AI</p>
            <p>Requires GOOGLE_GENERATIVE_AI_API_KEY</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 bg-[#f5f5f7]  text-foreground border border-none">
          <Loader2 className="w-8 h-8 text-black animate-spin mx-auto mb-4" />
          <p className="text-black font-bold text-lg">Analyzing interview performance...</p>
          <p className="text-gray-500 text-sm mt-2 font-mono">This may take a few moments</p>
        </div>
      )}

      {error && (
        <div className="bg-[#f5f5f7]  border border-none p-4 mb-6 shadow-neo">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 font-bold">Error: {error}</p>
          </div>
          
          {/* Show specific help based on error type */}
          {error.includes('quota') && (
            <div className="mt-3 text-sm text-red-700 border-t-2 border-red-200 pt-2">
              <p>💡 <strong>Solutions:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1 font-medium">
                <li>Wait a few minutes and try again</li>
                <li>Upgrade to a paid Google AI plan</li>
                <li>Check your usage at <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google AI Studio</a></li>
              </ul>
            </div>
          )}
          
          {error.includes('API key') && (
            <div className="mt-3 text-sm text-red-700 border-t-2 border-red-200 pt-2">
              <p>💡 <strong>Solutions:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1 font-medium">
                <li>Check your API key in environment variables</li>
                <li>Get a new API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google AI Studio</a></li>
                <li>Restart your development server</li>
              </ul>
            </div>
          )}
          
          <button
            onClick={handleEvaluate}
            disabled={error.includes('quota')}
            className="mt-4 text-sm bg-black text-white px-4 py-2 hover:bg-gray-800 font-bold uppercase tracking-wider"
          >
            {error.includes('quota') ? 'Wait before retrying...' : 'Try again'}
          </button>
        </div>
      )}

      {evaluation && (
        <div className="space-y-8">
          {/* Overall Rating & Recommendation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center bg-[#f5f5f7]  border border-none border border-none p-6 shadow-neo">
              <h3 className="text-black font-black uppercase text-sm mb-4">Overall Rating</h3>
              <div className="relative">
                <div className="w-32 h-32 mx-auto">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={evaluation.overallRating >= 8 ? '#000000' : evaluation.overallRating >= 6.5 ? '#000000' : '#000000'}
                      strokeWidth="12"
                      strokeLinecap="butt"
                      strokeDasharray={`${(evaluation.overallRating / 10) * 251.2} 251.2`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-4xl font-black ${getScoreColor(evaluation.overallRating)}`}>
                      {evaluation.overallRating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center bg-[#f5f5f7]  border border-none border border-none p-6 shadow-neo flex flex-col justify-center items-center">
              <h3 className="text-black font-black uppercase text-sm mb-4">Recommendation</h3>
              <div className={`inline-flex items-center gap-2 px-6 py-3 border border-none shadow-neo ${getRecommendationColor(evaluation.recommendation)}`}>
                {evaluation.recommendation === 'Strong Hire' && <CheckCircle className="w-6 h-6" />}
                {evaluation.recommendation === 'Hire' && <CheckCircle className="w-6 h-6" />}
                {evaluation.recommendation === 'No Hire' && <XCircle className="w-6 h-6" />}
                {evaluation.recommendation === 'Strong No Hire' && <XCircle className="w-6 h-6" />}
                <span className="font-black text-lg uppercase">{evaluation.recommendation}</span>
              </div>
              <p className="text-gray-500 text-xs mt-4 font-mono font-bold">
                Confidence: {evaluation.confidenceLevel}/10
              </p>
            </div>
          </div>

          {/* Aspect Ratings */}
          <div>
            <h3 className="text-2xl font-black text-black mb-6 border-b-2 border-black inline-block">Detailed Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(evaluation.aspects).map(([name, aspect]) => 
                renderAspectRating(name, aspect)
              )}
            </div>
          </div>

          {/* Strengths & Areas for Improvement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 border border-none p-6 shadow-neo">
              <h3 className="text-green-800 text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-wide border-b-2 border-green-800 pb-2">
                <TrendingUp className="w-6 h-6" />
                Strengths
              </h3>
              <ul className="space-y-3">
                {evaluation.strengths.map((strength, idx) => (
                  <li key={idx} className="text-black font-medium text-sm flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-orange-50 border border-none p-6 shadow-neo">
              <h3 className="text-orange-800 text-xl font-black mb-4 flex items-center gap-2 uppercase tracking-wide border-b-2 border-orange-800 pb-2">
                <AlertCircle className="w-6 h-6" />
                Improvements
              </h3>
              <ul className="space-y-3">
                {evaluation.areasForImprovement.map((area, idx) => (
                  <li key={idx} className="text-black font-medium text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Feedback */}
          <div>
            <h3 className="text-2xl font-black text-black mb-4 border-b-2 border-black inline-block">Detailed Feedback</h3>
            <div className="bg-[#f5f5f7]  text-foreground border border-none p-6 font-medium shadow-neo text-lg">
              <p className="text-black leading-relaxed">{evaluation.detailedFeedback}</p>
            </div>
          </div>

          {/* Re-evaluate Button */}
          <div className="text-center pt-8 border-t-2 border-black border-dashed">
            <button
              onClick={handleEvaluate}
              disabled={loading}
              className="text-purple-700 hover:text-purple-900 font-bold underline text-sm uppercase tracking-wider"
            >
              Re-evaluate Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
