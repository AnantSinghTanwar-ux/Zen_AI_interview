"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Star, ThumbsUp, ThumbsDown, TrendingUp, Brain, 
  Target, MessageSquare, BookOpen, CheckCircle,
  AlertCircle, Lightbulb, ArrowRight
} from 'lucide-react';
import { feedbackService, InterviewFeedback } from '@/services/feedback/feedback.service';

interface FeedbackDisplayProps {
  interviewId?: string;
  callId?: string;
  userId: string;
  callData?: any;
}

export default function FeedbackDisplay({ interviewId, callId, userId, callData }: FeedbackDisplayProps) {
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFeedbackSubmitted, setUserFeedbackSubmitted] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userComments, setUserComments] = useState('');

  useEffect(() => {
    fetchFeedback();
  }, [interviewId, callId]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const targetCallId = callId || interviewId;
      
      if (!targetCallId) {
        setError('No call ID or interview ID provided');
        console.error('No callId or interviewId provided');
        return;
      }

      console.log(`Fetching feedback for call: ${targetCallId}`);
      
      // Fetch real-time feedback from call data
      const response = await fetch(`/api/vapi/feedback?callId=${targetCallId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Feedback API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw new Error(`Failed to fetch feedback: ${errorData.error || response.statusText}`);
      }
      
      const feedbackData = await response.json();
      
      // Transform the API response to match our InterviewFeedback interface
      const transformedFeedback: InterviewFeedback = {
        id: feedbackData.id,
        userId: feedbackData.userId,
        interviewId: feedbackData.interviewId,
        callId: feedbackData.callId,
        interviewType: feedbackData.interviewType as any,
        overallScore: feedbackData.overallScore,
        communicationScore: feedbackData.communicationScore,
        technicalScore: feedbackData.technicalScore,
        problemSolvingScore: feedbackData.problemSolvingScore,
        confidenceScore: feedbackData.confidenceScore,
        strengths: feedbackData.strengths,
        weaknesses: feedbackData.weaknesses,
        suggestions: feedbackData.suggestions,
        nextSteps: feedbackData.nextSteps,
        responseTime: feedbackData.responseTime,
        completionRate: feedbackData.completionRate,
        duration: feedbackData.duration,
        aiSummary: feedbackData.aiSummary,
        personalizedPlan: feedbackData.personalizedPlan, // Array of strings
        createdAt: new Date(feedbackData.createdAt)
      };
      
      setFeedback(transformedFeedback);
      console.log('Successfully loaded real-time feedback');
      
    } catch (error) {
      console.error('Error fetching feedback:', error);
      
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setError(error.message);
      } else {
        setError('An unknown error occurred while fetching feedback');
      }
      
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  };

  const submitUserFeedback = async () => {
    try {
      const targetCallId = callId || interviewId;
      
      if (!targetCallId) {
        console.error('No callId or interviewId available for feedback submission');
        return;
      }

      const feedbackData = {
        callId: targetCallId,
        userId,
        rating: userRating,
        comments: userComments,
        difficulty: 'medium',
        wouldRecommend: userRating >= 4,
        improvementAreas: [],
        timestamp: new Date().toISOString()
      };
      
      console.log('Submitting user feedback:', feedbackData);
      setUserFeedbackSubmitted(true);
      console.log('User feedback submitted successfully');
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#f5f5f7]  border border-none rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
          ))}
        </div>
        <div className="h-40 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#f5f5f7]  border-2 border-red-600 shadow-neo">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
            <h3 className="text-red-700 font-black text-xl mb-2">Error Loading Feedback</h3>
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <p className="text-gray-600 text-sm mb-4">
              This might happen if the interview session doesn't have enough conversation data 
              or if there was an issue processing the interview.
            </p>
            <Button 
              onClick={() => {
                setError(null);
                fetchFeedback();
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold border border-none shadow-neo"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!feedback) {
    return (
      <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-black font-bold text-lg">Interview feedback not available yet.</p>
            <p className="text-gray-600 text-sm mt-2 font-medium">
              This interview session may not have enough conversation data to generate feedback, 
              or there might have been an issue processing the transcript.
            </p>
            <p className="text-gray-600 text-sm mt-2 font-medium">
              Try selecting a different interview session or ensure the interview was completed successfully.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-700';
    if (score >= 80) return 'text-yellow-700';
    if (score >= 70) return 'text-orange-700';
    return 'text-red-700';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-700 border-green-700';
    if (score >= 80) return 'bg-yellow-100 text-yellow-700 border-yellow-700';
    if (score >= 70) return 'bg-orange-100 text-orange-700 border-orange-700';
    return 'bg-red-100 text-red-700 border-red-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-black">Interview Feedback</h1>
        <Badge className={`${getScoreBadgeColor(feedback.overallScore)} border-2 font-bold text-lg px-4 py-1 self-start md:self-auto`}>
          Overall Score: {feedback.overallScore}%
        </Badge>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Communication</p>
                <p className={`text-3xl font-black ${getScoreColor(feedback.communicationScore)}`}>
                  {feedback.communicationScore}%
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Technical</p>
                <p className={`text-3xl font-black ${getScoreColor(feedback.technicalScore)}`}>
                  {feedback.technicalScore}%
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Problem Solving</p>
                <p className={`text-3xl font-black ${getScoreColor(feedback.problemSolvingScore)}`}>
                  {feedback.problemSolvingScore}%
                </p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Confidence</p>
                <p className={`text-3xl font-black ${getScoreColor(feedback.confidenceScore)}`}>
                  {feedback.confidenceScore}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary */}
      <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
        <CardHeader className="bg-[#f5f5f7]  border border-none border-b-2 border-black">
          <CardTitle className="text-black font-black flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-gray-800 leading-relaxed font-medium">
            {feedback.aiSummary}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
          <CardHeader className="bg-green-50 border-b-2 border-black">
            <CardTitle className="text-green-800 font-black flex items-center gap-2">
              <ThumbsUp className="w-5 h-5" />
              Key Strengths
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {feedback.strengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="bg-green-100 p-1 rounded-full border border-green-300 mt-0.5 shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                  </div>
                  <span className="text-gray-800 font-medium">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
          <CardHeader className="bg-[#f5f5f7]  border-b-2 border-black">
            <CardTitle className="text-red-800 font-black flex items-center gap-2">
              <ThumbsDown className="w-5 h-5" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {feedback.weaknesses.map((weakness, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="bg-red-100 p-1 rounded-full border border-red-300 mt-0.5 shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-700" />
                  </div>
                  <span className="text-gray-800 font-medium">{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

       {/* Suggestions and Next Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
          <CardHeader className="bg-yellow-50 border-b-2 border-black">
            <CardTitle className="text-yellow-800 font-black flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {feedback.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="bg-yellow-100 p-1 rounded-full border border-yellow-300 mt-0.5 shrink-0">
                    <Lightbulb className="w-4 h-4 text-yellow-700" />
                  </div>
                  <span className="text-gray-800 font-medium">{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
          <CardHeader className="bg-[#f5f5f7]  border-b-2 border-black">
             <CardTitle className="text-blue-800 font-black flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {feedback.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="bg-blue-100 p-1 rounded-full border border-blue-300 mt-0.5 shrink-0">
                    <ArrowRight className="w-4 h-4 text-blue-700" />
                  </div>
                  <span className="text-gray-800 font-medium">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Personalized Improvement Plan */}
      <Card className="bg-primary/5 border border-none shadow-neo overflow-hidden">
        <CardHeader className="bg-primary text-white border-b-2 border-black">
          <CardTitle className="font-black flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Personalized Improvement Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(feedback.personalizedPlan) ? feedback.personalizedPlan.map((plan: string, index: number) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-[#f5f5f7]  text-foreground rounded-3xl border border-none shadow-sm transition-transform hover:-translate-y-1">
                <div className="flex items-center justify-center w-8 h-8 bg-black text-white rounded-2xl text-sm font-black flex-shrink-0 border border-none shadow-neo">
                  {index + 1}
                </div>
                <p className="text-gray-800 font-bold leading-tight">{plan}</p>
              </div>
            )) : <p className="text-gray-800 font-medium">{feedback.personalizedPlan}</p>}
          </div>
        </CardContent>
      </Card>
      
      {/* User Feedback Section */}
      {!userFeedbackSubmitted && (
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo overflow-hidden">
          <CardHeader className="bg-[#f5f5f7]  border border-none border-b-2 border-black">
            <CardTitle className="text-black font-black">How was your experience?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="text-gray-700 font-bold mb-3">Rate this interview session:</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setUserRating(rating)}
                    className={`p-2 rounded-2xl transition-transform hover:scale-110 ${
                      userRating >= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star className="w-8 h-8 drop-shadow-sm" fill={userRating >= rating ? 'currentColor' : 'none'} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-gray-700 font-bold mb-2">Additional comments (optional):</p>
              <textarea
                value={userComments}
                onChange={(e) => setUserComments(e.target.value)}
                className="w-full p-4 bg-[#f5f5f7]  text-foreground border border-none rounded-3xl text-black placeholder-gray-400 resize-none focus:outline-none focus:shadow-neo"
                rows={3}
                placeholder="Share your thoughts about this interview experience..."
              />
            </div>

            <Button 
              onClick={submitUserFeedback} 
              className="bg-black text-white hover:bg-black/80 font-bold text-lg px-8 py-6 border border-none shadow-neo"
              disabled={userRating === 0}
            >
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      )}

      {userFeedbackSubmitted && (
        <Card className="bg-green-50 border-2 border-green-600 shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-full border-2 border-green-600">
                <CheckCircle className="w-8 h-8 text-green-700" />
              </div>
              <div>
                <p className="text-green-800 font-black text-xl">Thank you for your feedback!</p>
                <p className="text-green-700 font-medium">Your input helps us improve the interview experience.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
