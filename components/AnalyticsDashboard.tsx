"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, Calendar, Target, BarChart3, 
  Clock, Trophy, Star, ArrowUp, ArrowDown,
  Award, Brain, TrendingDown, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';

// Types (moved locally to avoid server imports)
interface AnalyticsSummary {
  totalInterviews: number;
  averageScore: number;
  totalTime: number;
  improvementRate: number;
  completionRate: number;
  commonWeaknesses: Record<string, number>;
  commonStrengths: Record<string, number>;
  strengthsFrequency: Record<string, number>;
  weaknessesFrequency: Record<string, number>;
  typeDistribution: Record<string, number>;
  skillTrends: Array<{
    date: string;
    technical: number;
    communication: number;
    problemSolving: number;
  }>;
  performanceTrend: Array<{
    date: string;
    score: number;
    type: string;
  }>;
  recentPerformance: Array<{
    date: string;
    score: number;
    type: string;
  }>;
}

interface AnalyticsDashboardProps {
  userId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [comparisonData, setComparisonData] = useState<{
    userAverage: number;
    platformAverage: number;
    percentile: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    fetchAnalytics();
  }, [userId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Replace with API calls or use mock data for now
      const mockAnalyticsData: AnalyticsSummary = {
        totalInterviews: 12,
        averageScore: 78,
        totalTime: 360,
        improvementRate: 15,
        completionRate: 85,
        commonWeaknesses: {
          "Time Management": 8,
          "System Design": 6,
          "Communication": 4
        },
        commonStrengths: {
          "Problem Solving": 10,
          "Code Quality": 8,
          "Technical Knowledge": 7
        },
        strengthsFrequency: {
          "Problem Solving": 10,
          "Code Quality": 8,
          "Technical Knowledge": 7,
          "Debugging": 6,
          "Algorithm Design": 5
        },
        weaknessesFrequency: {
          "Time Management": 8,
          "System Design": 6,
          "Communication": 4,
          "Testing": 3,
          "Documentation": 2
        },
        typeDistribution: {
          "technical": 8,
          "behavioral": 3,
          "system-design": 1
        },
        skillTrends: [
          { date: "2024-01", technical: 70, communication: 60, problemSolving: 75 },
          { date: "2024-02", technical: 75, communication: 65, problemSolving: 80 },
          { date: "2024-03", technical: 78, communication: 70, problemSolving: 82 }
        ],
        performanceTrend: [
          { date: "2024-01-15", score: 72, type: "technical" },
          { date: "2024-02-01", score: 75, type: "behavioral" },
          { date: "2024-02-15", score: 78, type: "technical" },
          { date: "2024-03-01", score: 80, type: "system-design" },
          { date: "2024-03-15", score: 82, type: "technical" }
        ],
        recentPerformance: [
          { date: "2024-03-15", score: 82, type: "technical" },
          { date: "2024-03-01", score: 80, type: "system-design" },
          { date: "2024-02-15", score: 78, type: "technical" }
        ]
      };

      const mockComparisonData = {
        userAverage: 78,
        platformAverage: 72,
        percentile: 68
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAnalytics(mockAnalyticsData);
      setComparisonData(mockComparisonData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-dark-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 bg-dark-200 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="bg-dark-200 border-gray-600">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-400">No analytics data available yet.</p>
            <p className="text-gray-500 text-sm mt-2">Complete some interviews to see your performance analytics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const performanceChange = analytics.performanceTrend.length >= 2 
    ? analytics.performanceTrend[analytics.performanceTrend.length - 1].score - 
      analytics.performanceTrend[0].score
    : 0;

  // Prepare data for charts
  const strengthsData = Object.entries(analytics.strengthsFrequency)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const weaknessesData = Object.entries(analytics.weaknessesFrequency)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const typeDistributionData = Object.entries(analytics.typeDistribution)
    .map(([name, value]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' '), 
      value: value as number
    }));

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Performance Analytics</h1>
        <div className="flex gap-2">
          {[30, 60, 90].map((days) => (
            <Button
              key={days}
              variant={timeRange === days ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(days as 30 | 60 | 90)}
              className={timeRange === days ? "bg-primary-600" : ""}
            >
              {days} Days
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Interviews</p>
                <p className="text-2xl font-bold text-white">{analytics.totalInterviews}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Average Score</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-white">{analytics.averageScore}%</p>
                  {performanceChange !== 0 && (
                    <span className={`flex items-center text-sm ${
                      performanceChange > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {performanceChange > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                      {Math.abs(performanceChange)}%
                    </span>
                  )}
                </div>
              </div>
              <Target className="h-8 w-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-200 border-gray-600">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Completion Rate</p>
                <p className="text-2xl font-bold text-white">{analytics.completionRate}%</p>
              </div>
              <Clock className="h-8 w-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>

        {comparisonData && (
          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Percentile Rank</p>
                  <p className="text-2xl font-bold text-white">{comparisonData.percentile}%</p>
                  <p className="text-xs text-gray-500">vs platform average</p>
                </div>
                <Award className="h-8 w-8 text-primary-400" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3B82F6" 
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Interview Type Distribution */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Interview Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {typeDistributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Strengths */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strengthsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={strengthsData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number"
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <Brain className="w-8 h-8 mb-2" />
                <p>No strengths data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Areas for Improvement */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weaknessesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weaknessesData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number"
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                <Brain className="w-8 h-8 mb-2" />
                <p>No improvement areas identified</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Comparison */}
      {comparisonData && (
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-400">Your Average</p>
                <p className="text-3xl font-bold text-white">{comparisonData.userAverage}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Platform Average</p>
                <p className="text-3xl font-bold text-gray-300">{comparisonData.platformAverage}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Your Rank</p>
                <p className="text-3xl font-bold text-primary-400">{comparisonData.percentile}th percentile</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
