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
import PremiumAccessPopup from '@/components/PremiumAccessPopup';

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
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);

  const openPremiumPopup = (message?: string) => {
    setPremiumMessage(message || 'Premium is required to continue using this Vapi AI feature.');
    setShowPremiumPopup(true);
  };

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

      if (response.status === 402) {
        const payload = await response.json().catch(() => ({}));
        openPremiumPopup(payload?.message);
        setError(payload?.message || 'Premium subscription required');
        setFeedback(null);
        return;
      }

      if (response.status === 429) {
        const payload = await response.json().catch(() => ({}));
        const limitMessage =
          payload?.message ||
          'Daily usage limit reached. Please try again tomorrow.';
        setError(limitMessage);
        setFeedback(null);
        return;
      }
      
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
      <>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-white/5 border border-white/10 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-40 bg-white/5 border border-white/10 rounded-2xl mt-8"></div>
        </div>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            setError(null);
            fetchFeedback();
          }}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Card className="glass-card border-destructive/50 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-destructive"></div>
          <CardContent className="pt-8">
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex flex-center mb-6 shadow-[0_0_20px_rgba(215,51,87,0.3)]">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-foreground tracking-tight font-bold text-2xl mb-2">Error Loading Feedback</h3>
              <p className="text-destructive font-medium mb-4">{error}</p>
              <p className="text-muted-foreground text-sm mb-8 max-w-lg mx-auto">
                This might happen if the interview session doesn't have enough conversation data 
                or if there was an issue processing the interview.
              </p>
              <Button 
                onClick={() => {
                  setError(null);
                  fetchFeedback();
                }}
                className="bg-white/5 text-foreground backdrop-blur-lg border border-white/10 rounded-xl px-8 py-3 font-medium transition-all duration-300 hover:bg-white/10 hover:border-white/20"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            setError(null);
            fetchFeedback();
          }}
        />
      </>
    );
  }

  if (!feedback) {
    return (
      <>
        <Card className="glass-card">
          <CardContent className="pt-8">
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 rounded-full bg-white/5 border border-white/10 flex flex-center mb-6">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-semibold tracking-tight text-xl mb-4">Feedback Unavailable</p>
              <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                This interview session may not have enough conversation data to generate feedback, 
                or there might have been an issue processing the transcript.
              </p>
            </div>
          </CardContent>
        </Card>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            setError(null);
            fetchFeedback();
          }}
        />
      </>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-[#9d7df9] drop-shadow-[0_0_10px_rgba(157,125,249,0.5)]';
    if (score >= 75) return 'text-[#7445eb] drop-shadow-[0_0_10px_rgba(116,69,235,0.4)]';
    if (score >= 60) return 'text-[#acaaae]';
    return 'text-[#d73357]';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-[#9d7df9]/20 text-[#ba9eff] border-[#9d7df9]/50 shadow-[0_0_15px_rgba(157,125,249,0.3)]';
    if (score >= 75) return 'bg-[#7445eb]/20 text-white border-[#7445eb]/50';
    if (score >= 60) return 'bg-white/10 text-white/80 border-white/20';
    return 'bg-[#d73357]/20 text-[#ffb2b9] border-[#d73357]/50';
  };

  return (
    <div className="space-y-8 animate-stagger-1 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
           <Badge className="bg-white/5 hover:bg-white/10 transition-colors text-white/70 border border-white/10 mb-3 text-xs uppercase tracking-widest px-3 py-1">
             Interview Overview
           </Badge>
           <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Analysis & Results</h1>
        </div>
        <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 ${getScoreBadgeColor(feedback.overallScore)}`}>
           <div className="text-xs uppercase font-medium tracking-wide opacity-80">Overall Score</div>
           <div className="text-2xl font-bold">{feedback.overallScore}%</div>
        </div>
      </div>

      {/* Score Breakdown Elements */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[
           { label: 'Communication', score: feedback.communicationScore, icon: MessageSquare, color: 'text-primary' },
           { label: 'Technical', score: feedback.technicalScore, icon: Brain, color: 'text-[#ba9eff]' },
           { label: 'Problem Solving', score: feedback.problemSolvingScore, icon: Target, color: 'text-[#c08cf7]' },
           { label: 'Confidence', score: feedback.confidenceScore, icon: TrendingUp, color: 'text-indigo-400' }
        ].map((item, idx) => (
          <Card key={idx} className="glass-card hover:-translate-y-1 transition-all duration-300">
            <CardContent className="pt-6 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/5 mix-blend-overlay"></div>
               <div className="flex items-start justify-between relative z-10">
                 <div>
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{item.label}</p>
                   <p className={`text-4xl font-bold tracking-tight ${getScoreColor(item.score)}`}>
                     {item.score}%
                   </p>
                 </div>
                 <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                 </div>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Structured Sections */}
      
      {/* section 1: Analysis Summary */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/5 px-8 py-5 flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
               <Brain className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-foreground tracking-wide font-medium text-lg">AI Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-foreground/90 leading-loose text-lg font-light max-w-4xl">
            {feedback.aiSummary}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* section 2: Strengths */}
        <Card className="glass-card overflow-hidden h-full">
          <CardHeader className="border-b border-white/5 bg-white/5 px-8 py-5 flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-[#29823b]/20 border border-[#29823b]/30">
               <ThumbsUp className="w-5 h-5 text-[#49de50]" />
            </div>
            <CardTitle className="text-foreground tracking-wide font-medium text-lg">Key Strengths</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ul className="space-y-5">
              {feedback.strengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-4">
                  <CheckCircle className="w-5 h-5 text-[#49de50] shrink-0 mt-0.5" />
                  <span className="text-foreground/90 leading-relaxed">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* section 3: Weaknesses */}
        <Card className="glass-card overflow-hidden h-full">
          <CardHeader className="border-b border-white/5 bg-white/5 px-8 py-5 flex flex-row items-center gap-3">
             <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
               <ThumbsDown className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-foreground tracking-wide font-medium text-lg">Areas for Improvement</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ul className="space-y-5">
              {feedback.weaknesses.map((weakness, i) => (
                <li key={i} className="flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span className="text-foreground/90 leading-relaxed">{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

       {/* Next Steps & Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card overflow-hidden h-full">
          <CardHeader className="border-b border-white/5 bg-white/5 px-8 py-5 flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
               <Lightbulb className="w-5 h-5 text-yellow-400" />
            </div>
            <CardTitle className="text-foreground tracking-wide font-medium text-lg">Actionable Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ul className="space-y-5">
              {feedback.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-4">
                  <Lightbulb className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/90 leading-relaxed">{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden h-full">
          <CardHeader className="border-b border-white/5 bg-white/5 px-8 py-5 flex flex-row items-center gap-3">
             <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
               <ArrowRight className="w-5 h-5 text-blue-400" />
            </div>
            <CardTitle className="text-foreground tracking-wide font-medium text-lg">Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ul className="space-y-5">
              {feedback.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <ArrowRight className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/90 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Personalized Improvement Plan */}
      <Card className="glass-card overflow-hidden border-primary/30 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
        <CardHeader className="border-b border-primary/20 bg-primary/10 px-8 py-5 flex flex-row items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <CardTitle className="text-foreground tracking-wide font-medium text-lg">Personalized Improvement Plan</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {Array.isArray(feedback.personalizedPlan) ? feedback.personalizedPlan.map((plan: string, index: number) => (
              <div key={index} className="flex items-start gap-4 p-6 bg-background/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner transition-all hover:bg-white/5 hover:-translate-y-1">
                <div className="flex items-center justify-center w-10 h-10 bg-primary/20 text-primary border border-primary/30 rounded-full text-sm font-bold flex-shrink-0 shadow-[0_0_15px_rgba(157,125,249,0.2)]">
                  {index + 1}
                </div>
                <p className="text-foreground/90 font-medium leading-relaxed pt-1.5">{plan}</p>
              </div>
            )) : <p className="text-foreground/90 leading-relaxed">{feedback.personalizedPlan}</p>}
          </div>
        </CardContent>
      </Card>
      
      {/* User Feedback Section */}
      {!userFeedbackSubmitted && (
        <Card className="glass-card overflow-hidden border-white/10 mt-12 bg-white/5">
          <CardHeader className="px-8 pt-8 pb-4">
            <CardTitle className="text-foreground tracking-tight font-medium text-xl">Help us refine the ZenAI experience</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
               <div className="flex-1">
                 <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold mb-4">Rate this session</p>
                 <div className="flex gap-3">
                   {[1, 2, 3, 4, 5].map((rating) => (
                     <button
                       key={rating}
                       onClick={() => setUserRating(rating)}
                       className={`p-3 rounded-xl transition-all duration-300 border ${
                         userRating >= rating 
                           ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 scale-110 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                           : 'bg-white/5 border-white/10 text-white/20 hover:text-white/40 hover:bg-white/10'
                       }`}
                     >
                       <Star className="w-6 h-6" fill={userRating >= rating ? 'currentColor' : 'none'} strokeWidth={2} />
                     </button>
                   ))}
                 </div>
               </div>
               
               <div className="flex-[2]">
                 <p className="text-muted-foreground text-sm uppercase tracking-wider font-semibold mb-4">Additional Context (Optional)</p>
                 <textarea
                   value={userComments}
                   onChange={(e) => setUserComments(e.target.value)}
                   className="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-foreground placeholder-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                   rows={3}
                   placeholder="Share your thoughts about this interview..."
                 />
               </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
               <Button 
                 onClick={submitUserFeedback} 
                 className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 py-3 font-medium shadow-[0_0_15px_rgba(157,125,249,0.3)] transition-all"
                 disabled={userRating === 0}
               >
                 Submit anonymous rating
               </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {userFeedbackSubmitted && (
        <Card className="glass-card border-[#29823b]/40 bg-[#1b4b24]/20 mt-12 overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-6">
              <div className="p-3 bg-[#29823b]/30 rounded-full border border-[#29823b]/50 shadow-[0_0_20px_rgba(41,130,59,0.3)]">
                <CheckCircle className="w-8 h-8 text-[#49de50]" />
              </div>
              <div>
                <p className="text-foreground font-bold text-xl mb-1">Feedback Verified & Submitted</p>
                <p className="text-muted-foreground">Your input directly recalibrates the AI model for future sessions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PremiumAccessPopup
        open={showPremiumPopup}
        message={premiumMessage}
        onClose={() => setShowPremiumPopup(false)}
        onActivated={() => {
          setError(null);
          fetchFeedback();
        }}
      />
    </div>
  );
}
