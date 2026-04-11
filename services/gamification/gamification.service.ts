// Gamification Service - Handles badges, levels, streaks, and achievements
import { db } from "@/services/firebase/admin";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'interview' | 'performance' | 'streak' | 'achievement';
  requirements: {
    type: 'interview_count' | 'score_average' | 'streak_days' | 'improvement' | 'special';
    value: number;
    timeframe?: number; // days
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
}

export interface UserProgress {
  userId: string;
  level: number;
  totalPoints: number;
  experiencePoints: number;
  nextLevelPoints: number;
  
  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastInterviewDate?: Date;
  
  // Badges
  earnedBadges: string[];
  badgeProgress: Record<string, number>;
  
  // Statistics
  totalInterviews: number;
  totalMinutesSpent: number;
  averageScore: number;
  improvementRate: number;
  
  // Achievements
  achievements: string[];
  milestones: Record<string, Date>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  hidden: boolean; // Hidden until unlocked
  category: string;
}

class GamificationService {
  private readonly PROGRESS_COLLECTION = 'user_progress';
  private readonly BADGES_COLLECTION = 'badges';
  private readonly ACHIEVEMENTS_COLLECTION = 'achievements';

  // Badge definitions
  private readonly DEFAULT_BADGES: Badge[] = [
    {
      id: 'first_interview',
      name: 'First Steps',
      description: 'Complete your first interview',
      icon: '🎯',
      category: 'interview',
      requirements: { type: 'interview_count', value: 1 },
      rarity: 'common',
      points: 10,
    },
    {
      id: 'interview_veteran',
      name: 'Interview Veteran',
      description: 'Complete 10 interviews',
      icon: '🏆',
      category: 'interview',
      requirements: { type: 'interview_count', value: 10 },
      rarity: 'uncommon',
      points: 50,
    },
    {
      id: 'high_performer',
      name: 'High Performer',
      description: 'Achieve 90% average score',
      icon: '⭐',
      category: 'performance',
      requirements: { type: 'score_average', value: 90 },
      rarity: 'rare',
      points: 100,
    },
    {
      id: 'streak_master',
      name: 'Streak Master',
      description: 'Maintain a 7-day interview streak',
      icon: '🔥',
      category: 'streak',
      requirements: { type: 'streak_days', value: 7 },
      rarity: 'epic',
      points: 200,
    },
    {
      id: 'improvement_champion',
      name: 'Improvement Champion',
      description: 'Improve score by 20% over 5 interviews',
      icon: '📈',
      category: 'achievement',
      requirements: { type: 'improvement', value: 20 },
      rarity: 'legendary',
      points: 300,
    },
  ];

  async initializeUserProgress(userId: string): Promise<UserProgress> {
    try {
      const existingProgress = await this.getUserProgress(userId);
      if (existingProgress) {
        return existingProgress;
      }

      const initialProgress: UserProgress = {
        userId,
        level: 1,
        totalPoints: 0,
        experiencePoints: 0,
        nextLevelPoints: 100,
        currentStreak: 0,
        longestStreak: 0,
        earnedBadges: [],
        badgeProgress: {},
        totalInterviews: 0,
        totalMinutesSpent: 0,
        averageScore: 0,
        improvementRate: 0,
        achievements: [],
        milestones: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection(this.PROGRESS_COLLECTION).doc(userId).set(initialProgress);
      return initialProgress;
    } catch (error) {
      console.error('Error initializing user progress:', error);
      throw error;
    }
  }

  async getUserProgress(userId: string): Promise<UserProgress | null> {
    try {
      const doc = await db.collection(this.PROGRESS_COLLECTION).doc(userId).get();
      
      if (!doc.exists) {
        return null;
      }

      return doc.data() as UserProgress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  async updateProgress(userId: string, interviewData: {
    score: number;
    duration: number;
    interviewType: string;
    completed: boolean;
  }): Promise<{
    newBadges: Badge[];
    levelUp: boolean;
    newLevel?: number;
    streakUpdated: boolean;
  }> {
    try {
      let progress = await this.getUserProgress(userId);
      if (!progress) {
        progress = await this.initializeUserProgress(userId);
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Update basic stats
      progress.totalInterviews += 1;
      progress.totalMinutesSpent += interviewData.duration;
      
      // Calculate new average score
      const totalScore = (progress.averageScore * (progress.totalInterviews - 1)) + interviewData.score;
      progress.averageScore = Math.round(totalScore / progress.totalInterviews);

      // Update streak
      let streakUpdated = false;
      if (progress.lastInterviewDate) {
        const lastDate = new Date(progress.lastInterviewDate);
        const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff === 1) {
          progress.currentStreak += 1;
          streakUpdated = true;
        } else if (daysDiff > 1) {
          progress.currentStreak = 1;
          streakUpdated = true;
        }
      } else {
        progress.currentStreak = 1;
        streakUpdated = true;
      }

      if (progress.currentStreak > progress.longestStreak) {
        progress.longestStreak = progress.currentStreak;
      }

      progress.lastInterviewDate = now;

      // Award points based on performance
      let pointsEarned = 10; // Base points
      if (interviewData.score >= 90) pointsEarned += 20;
      else if (interviewData.score >= 80) pointsEarned += 15;
      else if (interviewData.score >= 70) pointsEarned += 10;

      // Streak bonus
      if (progress.currentStreak >= 3) {
        pointsEarned += progress.currentStreak * 2;
      }

      progress.totalPoints += pointsEarned;
      progress.experiencePoints += pointsEarned;

      // Check for level up
      let levelUp = false;
      let newLevel = progress.level;
      while (progress.experiencePoints >= progress.nextLevelPoints) {
        progress.experiencePoints -= progress.nextLevelPoints;
        progress.level += 1;
        newLevel = progress.level;
        levelUp = true;
        progress.nextLevelPoints = this.calculateNextLevelPoints(progress.level);
      }

      // Check for new badges
      const newBadges = await this.checkForNewBadges(progress);
      
      // Award badge points
      for (const badge of newBadges) {
        progress.totalPoints += badge.points;
        progress.earnedBadges.push(badge.id);
      }

      progress.updatedAt = now;

      // Save progress
      await db.collection(this.PROGRESS_COLLECTION).doc(userId).set(progress);

      return {
        newBadges,
        levelUp,
        newLevel: levelUp ? newLevel : undefined,
        streakUpdated,
      };
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  private calculateNextLevelPoints(level: number): number {
    // Exponential growth: 100 * 1.5^(level-1)
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  private async checkForNewBadges(progress: UserProgress): Promise<Badge[]> {
    const newBadges: Badge[] = [];

    for (const badge of this.DEFAULT_BADGES) {
      if (progress.earnedBadges.includes(badge.id)) {
        continue; // Already earned
      }

      let earned = false;

      switch (badge.requirements.type) {
        case 'interview_count':
          earned = progress.totalInterviews >= badge.requirements.value;
          break;
        case 'score_average':
          earned = progress.averageScore >= badge.requirements.value;
          break;
        case 'streak_days':
          earned = progress.currentStreak >= badge.requirements.value;
          break;
        case 'improvement':
          // This would require more complex tracking - simplified for now
          earned = progress.improvementRate >= badge.requirements.value;
          break;
      }

      if (earned) {
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  async getUserLeaderboard(limit: number = 10): Promise<Array<{
    userId: string;
    userName?: string;
    level: number;
    totalPoints: number;
    rank: number;
  }>> {
    try {
      const snapshot = await db
        .collection(this.PROGRESS_COLLECTION)
        .orderBy('totalPoints', 'desc')
        .limit(limit)
        .get();

      const leaderboard = snapshot.docs.map((doc, index) => {
        const data = doc.data() as UserProgress;
        return {
          userId: data.userId,
          level: data.level,
          totalPoints: data.totalPoints,
          rank: index + 1,
        };
      });

      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  async getUserRank(userId: string): Promise<number> {
    try {
      const userProgress = await this.getUserProgress(userId);
      if (!userProgress) return 0;

      const snapshot = await db
        .collection(this.PROGRESS_COLLECTION)
        .where('totalPoints', '>', userProgress.totalPoints)
        .get();

      return snapshot.size + 1;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return 0;
    }
  }

  getBadgesByCategory(category?: Badge['category']): Badge[] {
    if (!category) return this.DEFAULT_BADGES;
    return this.DEFAULT_BADGES.filter(badge => badge.category === category);
  }

  getBadgeById(badgeId: string): Badge | undefined {
    return this.DEFAULT_BADGES.find(badge => badge.id === badgeId);
  }
}

export const gamificationService = new GamificationService();
