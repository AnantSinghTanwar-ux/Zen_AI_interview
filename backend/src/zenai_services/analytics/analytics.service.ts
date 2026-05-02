// Analytics Service - Modular service for performance tracking
import { db } from "@/services/firebase/admin";

export interface UserPerformanceData {
  userId: string;
  interviewId: string;
  interviewType: 'behavioral' | 'technical' | 'system-design' | 'dsa';
  score: number;
  completionRate: number;
  duration: number; // in minutes
  strengths: string[];
  weaknesses: string[];
  createdAt: Date;
  feedback?: {
    communicationScore: number;
    technicalScore: number;
    problemSolvingScore: number;
    confidenceScore: number;
  };
}

export interface AnalyticsSummary {
  totalInterviews: number;
  averageScore: number;
  completionRate: number;
  strengthsFrequency: Record<string, number>;
  weaknessesFrequency: Record<string, number>;
  performanceTrend: Array<{
    date: string;
    score: number;
    type: string;
  }>;
  typeDistribution: Record<string, number>;
}

class AnalyticsService {
  private readonly COLLECTION = 'user_performance';

  async recordPerformance(data: UserPerformanceData): Promise<string> {
    try {
      const docRef = await db.collection(this.COLLECTION).add({
        ...data,
        createdAt: new Date(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error recording performance:', error);
      throw error;
    }
  }

  async getUserAnalytics(userId: string, days: number = 30): Promise<AnalyticsSummary> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const snapshot = await db
        .collection(this.COLLECTION)
        .where('userId', '==', userId)
        .where('createdAt', '>=', startDate)
        .orderBy('createdAt', 'desc')
        .get();

      const performances = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserPerformanceData & { id: string })[];

      return this.calculateAnalytics(performances);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw error;
    }
  }

  private calculateAnalytics(performances: UserPerformanceData[]): AnalyticsSummary {
    if (performances.length === 0) {
      return {
        totalInterviews: 0,
        averageScore: 0,
        completionRate: 0,
        strengthsFrequency: {},
        weaknessesFrequency: {},
        performanceTrend: [],
        typeDistribution: {},
      };
    }

    const totalInterviews = performances.length;
    const averageScore = performances.reduce((sum, p) => sum + p.score, 0) / totalInterviews;
    const completionRate = performances.reduce((sum, p) => sum + p.completionRate, 0) / totalInterviews;

    // Calculate strengths and weaknesses frequency
    const strengthsFrequency: Record<string, number> = {};
    const weaknessesFrequency: Record<string, number> = {};
    
    performances.forEach(p => {
      p.strengths.forEach(strength => {
        strengthsFrequency[strength] = (strengthsFrequency[strength] || 0) + 1;
      });
      p.weaknesses.forEach(weakness => {
        weaknessesFrequency[weakness] = (weaknessesFrequency[weakness] || 0) + 1;
      });
    });

    // Performance trend (last 7 data points)
    const performanceTrend = performances
      .slice(0, 7)
      .reverse()
      .map(p => ({
        date: p.createdAt.toISOString().split('T')[0],
        score: p.score,
        type: p.interviewType,
      }));

    // Type distribution
    const typeDistribution: Record<string, number> = {};
    performances.forEach(p => {
      typeDistribution[p.interviewType] = (typeDistribution[p.interviewType] || 0) + 1;
    });

    return {
      totalInterviews,
      averageScore: Math.round(averageScore),
      completionRate: Math.round(completionRate),
      strengthsFrequency,
      weaknessesFrequency,
      performanceTrend,
      typeDistribution,
    };
  }

  async getComparisonData(userId: string): Promise<{
    userAverage: number;
    platformAverage: number;
    percentile: number;
  }> {
    try {
      // Get user's average
      const userAnalytics = await this.getUserAnalytics(userId);
      
      // Get platform average (sample from recent performances)
      const platformSnapshot = await db
        .collection(this.COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(1000)
        .get();

      const platformPerformances = platformSnapshot.docs.map(doc => doc.data()) as UserPerformanceData[];
      const platformAverage = platformPerformances.length > 0 
        ? platformPerformances.reduce((sum, p) => sum + p.score, 0) / platformPerformances.length
        : 0;

      // Calculate percentile
      const userScore = userAnalytics.averageScore;
      const lowerScores = platformPerformances.filter(p => p.score < userScore).length;
      const percentile = Math.round((lowerScores / platformPerformances.length) * 100);

      return {
        userAverage: userAnalytics.averageScore,
        platformAverage: Math.round(platformAverage),
        percentile,
      };
    } catch (error) {
      console.error('Error getting comparison data:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
