"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, Target, TrendingUp, Calendar, Award, 
  Star, Flame, Users, Clock, ChevronRight,
  Zap, BookOpen, Brain, Code, MessageSquare
} from 'lucide-react';

// Types (moved locally to avoid server imports)
interface UserProgress {
  userId: string;
  level: number;
  experiencePoints: number;
  nextLevelPoints: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  earnedBadges: string[];
  totalInterviews: number;
  averageScore: number;
  totalMinutesSpent: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface GameBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: string;
  points: number;
  criteria: any;
}

interface ProgressDashboardProps {
  userId: string;
}

export default function ProgressDashboard({ userId }: ProgressDashboardProps) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [badges, setBadges] = useState<GameBadge[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, [userId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Use API calls instead of direct service imports
      const [progressResponse, badgesResponse, leaderboardResponse] = await Promise.all([
        fetch(`/api/v2/gamification/progress?userId=${userId}`),
        fetch('/api/v2/gamification/badges'),
        fetch('/api/v2/gamification/leaderboard?limit=10')
      ]);

      const [userProgress, userBadges, leaderboardData] = await Promise.all([
        progressResponse.ok ? progressResponse.json() : null,
        badgesResponse.ok ? badgesResponse.json() : [],
        leaderboardResponse.ok ? leaderboardResponse.json() : []
      ]);

      setProgress(userProgress);
      setBadges(userBadges);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-dark-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-80 bg-dark-200 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <Card className="bg-dark-200 border-gray-600">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-400">Unable to load progress data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = (progress.experiencePoints / progress.nextLevelPoints) * 100;
  const earnedBadgesData = badges.filter(badge => progress.earnedBadges.includes(badge.id));
  const availableBadges = badges.filter(badge => !progress.earnedBadges.includes(badge.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Progress Dashboard</h1>
          <p className="text-gray-400 mt-1">Track your learning journey and achievements</p>
        </div>
      </div>

      {/* Level and Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Level</p>
                <p className="text-3xl font-bold text-white">{progress.level}</p>
                <p className="text-xs text-gray-500">
                  {progress.experiencePoints}/{progress.nextLevelPoints} XP
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Current Streak</p>
                <p className="text-3xl font-bold text-white">{progress.currentStreak}</p>
                <p className="text-xs text-gray-500">
                  Best: {progress.longestStreak} days
                </p>
              </div>
              <Flame className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Points</p>
                <p className="text-3xl font-bold text-white">{progress.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500">
                  Rank #{(progress as any).rank || 'N/A'}
                </p>
              </div>
              <Star className="h-8 w-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <Card className="bg-dark-200 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Your Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{progress.totalInterviews}</p>
              <p className="text-sm text-gray-400">Total Interviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{progress.averageScore}%</p>
              <p className="text-sm text-gray-400">Average Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{Math.round(progress.totalMinutesSpent / 60)}h</p>
              <p className="text-sm text-gray-400">Time Practiced</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{earnedBadgesData.length}</p>
              <p className="text-sm text-gray-400">Badges Earned</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earned Badges */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5" />
              Earned Badges ({earnedBadgesData.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {earnedBadgesData.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {earnedBadgesData.map((badge) => (
                  <div key={badge.id} className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                    <div className="text-2xl mb-2">{badge.icon}</div>
                    <h4 className="font-semibold text-white text-sm">{badge.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{badge.description}</p>
                    <Badge 
                      className={`mt-2 text-xs ${
                        badge.rarity === 'legendary' ? 'bg-purple-600 text-white' :
                        badge.rarity === 'epic' ? 'bg-yellow-600 text-white' :
                        badge.rarity === 'rare' ? 'bg-blue-600 text-white' :
                        badge.rarity === 'uncommon' ? 'bg-green-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}
                    >
                      {badge.rarity}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No badges earned yet</p>
                <p className="text-sm mt-1">Complete interviews to earn your first badge!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Badges */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Available Badges ({availableBadges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableBadges.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {availableBadges.slice(0, 5).map((badge) => (
                  <div key={badge.id} className="flex items-center gap-3 p-3 bg-dark-100 rounded-2xl border border-gray-600 opacity-70">
                    <div className="text-2xl">{badge.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-sm">{badge.name}</h4>
                      <p className="text-xs text-gray-400">{badge.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          className={`text-xs ${
                            badge.rarity === 'legendary' ? 'bg-purple-600 text-white' :
                            badge.rarity === 'epic' ? 'bg-yellow-600 text-white' :
                            badge.rarity === 'rare' ? 'bg-blue-600 text-white' :
                            badge.rarity === 'uncommon' ? 'bg-green-600 text-white' :
                            'bg-gray-600 text-white'
                          }`}
                        >
                          {badge.rarity}
                        </Badge>
                        <span className="text-xs text-primary-400">+{badge.points} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>All badges earned!</p>
                <p className="text-sm mt-1">You're a champion!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="bg-dark-200 border-gray-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((user, index) => (
              <div 
                key={user.userId} 
                className={`flex items-center justify-between p-3 rounded-2xl ${
                  user.userId === userId ? 'bg-[#f5f5f7] border border-primary-600' : 'bg-dark-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    index === 0 ? 'bg-yellow-500 text-black' :
                    index === 1 ? 'bg-gray-400 text-black' :
                    index === 2 ? 'bg-orange-500 text-black' :
                    'bg-dark-200 text-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {user.userId === userId ? 'You' : `User ${user.userId.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-gray-400">Level {user.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{user.totalPoints.toLocaleString()} pts</p>
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-orange-400 text-sm">{user.currentStreak}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

