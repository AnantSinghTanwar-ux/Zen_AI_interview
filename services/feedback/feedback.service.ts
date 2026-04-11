// Enhanced Feedback Service - Generates AI-powered suggestions
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/services/firebase/admin";

export interface InterviewFeedback {
  id?: string;
  userId: string;
  interviewId: string;
  callId?: string;
  interviewType: 'behavioral' | 'technical' | 'system-design' | 'dsa';
  
  // Core feedback scores
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  
  // Detailed feedback
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  nextSteps: string[];
  
  // Performance metrics
  responseTime: number; // average response time
  completionRate: number;
  duration: number; // in minutes
  
  // User feedback (optional)
  userRating?: number; // 1-5 stars
  userComments?: string;
  
  // AI-generated content
  aiSummary: string;
  personalizedPlan: string[];
  
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserFeedbackSubmission {
  interviewId: string;
  rating: number;
  comments: string;
  difficulty: 'easy' | 'medium' | 'hard';
  wouldRecommend: boolean;
  improvementAreas: string[];
}

class FeedbackService {
  private readonly COLLECTION = 'interview_feedback';
  private readonly USER_FEEDBACK_COLLECTION = 'user_feedback';
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateAIFeedback(transcript: any[], interviewType: string): Promise<{
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    nextSteps: string[];
    aiSummary: string;
    personalizedPlan: string[];
    scores: {
      communication: number;
      technical: number;
      problemSolving: number;
      confidence: number;
      overall: number;
    };
  }> {
    if (!this.genAI) {
      throw new Error('AI service not available');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const prompt = `
Analyze this ${interviewType} interview transcript and provide detailed feedback:

Transcript: ${JSON.stringify(transcript)}

Please provide a comprehensive analysis in JSON format with:
1. strengths (array of 3-5 specific strengths)
2. weaknesses (array of 3-5 areas for improvement)
3. suggestions (array of 5-7 actionable suggestions)
4. nextSteps (array of 3-5 specific next steps)
5. aiSummary (2-3 sentence summary)
6. personalizedPlan (array of 5-7 personalized improvement actions)
7. scores (object with communication, technical, problemSolving, confidence scores 0-100, and overall score)

Focus on:
- Communication clarity and effectiveness
- Technical knowledge and accuracy
- Problem-solving approach
- Confidence and presentation
- Specific improvement areas
- Actionable next steps

Return only valid JSON.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating AI feedback:', error);
      
      // Fallback feedback
      return {
        strengths: ['Completed the interview', 'Showed engagement'],
        weaknesses: ['Could improve response clarity', 'Need more specific examples'],
        suggestions: ['Practice common interview questions', 'Prepare specific examples', 'Work on communication skills'],
        nextSteps: ['Schedule practice sessions', 'Review technical concepts', 'Prepare STAR method responses'],
        aiSummary: 'The interview showed good engagement but could benefit from more structured responses and specific examples.',
        personalizedPlan: ['Practice 30 minutes daily', 'Record yourself answering questions', 'Join interview practice groups'],
        scores: {
          communication: 70,
          technical: 65,
          problemSolving: 75,
          confidence: 70,
          overall: 70,
        },
      };
    }
  }

  async createFeedback(data: Omit<InterviewFeedback, 'id' | 'createdAt'>): Promise<string> {
    try {
      const feedbackData = {
        ...data,
        createdAt: new Date(),
      };

      const docRef = await db.collection(this.COLLECTION).add(feedbackData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating feedback:', error);
      throw error;
    }
  }

  async getFeedback(feedbackId: string): Promise<InterviewFeedback | null> {
    try {
      const doc = await db.collection(this.COLLECTION).doc(feedbackId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      } as InterviewFeedback;
    } catch (error) {
      console.error('Error getting feedback:', error);
      throw error;
    }
  }

  async getFeedbackByInterview(interviewId: string): Promise<InterviewFeedback | null> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where('interviewId', '==', interviewId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as InterviewFeedback;
    } catch (error) {
      console.error('Error getting feedback by interview:', error);
      throw error;
    }
  }

  async getUserFeedbacks(userId: string, limit: number = 10): Promise<InterviewFeedback[]> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as InterviewFeedback[];
    } catch (error) {
      console.error('Error getting user feedbacks:', error);
      throw error;
    }
  }

  async submitUserFeedback(data: UserFeedbackSubmission & { userId: string }): Promise<string> {
    try {
      const feedbackData = {
        ...data,
        createdAt: new Date(),
      };

      const docRef = await db.collection(this.USER_FEEDBACK_COLLECTION).add(feedbackData);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting user feedback:', error);
      throw error;
    }
  }

  async updateFeedback(feedbackId: string, updates: Partial<InterviewFeedback>): Promise<void> {
    try {
      await db.collection(this.COLLECTION).doc(feedbackId).update({
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  // Analytics helper methods
  async getFeedbackStats(userId: string): Promise<{
    totalFeedbacks: number;
    averageOverallScore: number;
    averageByType: Record<string, number>;
    improvementTrend: Array<{ date: string; score: number }>;
  }> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const feedbacks = snapshot.docs.map(doc => doc.data()) as InterviewFeedback[];

      if (feedbacks.length === 0) {
        return {
          totalFeedbacks: 0,
          averageOverallScore: 0,
          averageByType: {},
          improvementTrend: [],
        };
      }

      const averageOverallScore = feedbacks.reduce((sum, f) => sum + f.overallScore, 0) / feedbacks.length;

      // Calculate average by type
      const averageByType: Record<string, number> = {};
      const typeGroups = feedbacks.reduce((groups, feedback) => {
        const type = feedback.interviewType;
        if (!groups[type]) groups[type] = [];
        groups[type].push(feedback);
        return groups;
      }, {} as Record<string, InterviewFeedback[]>);

      Object.entries(typeGroups).forEach(([type, typeFeedbacks]) => {
        averageByType[type] = typeFeedbacks.reduce((sum, f) => sum + f.overallScore, 0) / typeFeedbacks.length;
      });

      // Improvement trend (last 10 scores)
      const improvementTrend = feedbacks
        .slice(0, 10)
        .reverse()
        .map(feedback => ({
          date: feedback.createdAt.toISOString().split('T')[0],
          score: feedback.overallScore,
        }));

      return {
        totalFeedbacks: feedbacks.length,
        averageOverallScore: Math.round(averageOverallScore),
        averageByType,
        improvementTrend,
      };
    } catch (error) {
      console.error('Error getting feedback stats:', error);
      throw error;
    }
  }
}

export const feedbackService = new FeedbackService();
