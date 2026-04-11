"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, Code, Users, Database, Clock, Star, 
  Calendar, ArrowRight, Play, TrendingUp 
} from 'lucide-react';
import { useI18n } from '@/components/I18nProvider';
import dayjs from 'dayjs';

interface EnhancedCallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
  interviewType?: 'behavioral' | 'technical' | 'system-design' | 'dsa';
  difficulty?: 'easy' | 'medium' | 'hard';
  score?: number;
  feedback?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
  };
}

interface EnhancedInterviewCardProps {
  callData: EnhancedCallData;
  interviewNumber: number;
}

const interviewTypeConfig = {
  behavioral: {
    name: 'Behavioral',
    icon: Users,
    color: 'bg-blue-600',
    description: 'Communication and soft skills assessment',
    gradient: 'from-blue-500 to-blue-700',
  },
  technical: {
    name: 'Technical',
    icon: Code,
    color: 'bg-green-600',
    description: 'Technical knowledge and coding skills',
    gradient: 'from-green-500 to-green-700',
  },
  'system-design': {
    name: 'System Design',
    icon: Database,
    color: 'bg-purple-600',
    description: 'Architecture and system design principles',
    gradient: 'from-purple-500 to-purple-700',
  },
  dsa: {
    name: 'DSA',
    icon: Brain,
    color: 'bg-orange-600',
    description: 'Data structures and algorithms',
    gradient: 'from-orange-500 to-orange-700',
  },
};

const difficultyConfig = {
  easy: { color: 'bg-green-500', text: 'Easy' },
  medium: { color: 'bg-yellow-500', text: 'Medium' },
  hard: { color: 'bg-[#f5f5f7] 0', text: 'Hard' },
};

export default function EnhancedInterviewCard({ callData, interviewNumber }: EnhancedInterviewCardProps) {
  const { t } = useI18n();
  
  // Determine interview type (fallback logic if not provided)
  const inferredType = callData.interviewType || 'technical';
  const typeConfig = interviewTypeConfig[inferredType];
  const TypeIcon = typeConfig.icon;
  
  // Calculate duration in minutes
  const duration = callData.duration || 
    (callData.endedAt ? Math.round((new Date(callData.endedAt).getTime() - new Date(callData.startedAt).getTime()) / 60000) : 0);
  
  // Status styling
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ended': return 'text-green-400';
      case 'in-progress': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('MMM D, YYYY');
  };

  const formatTime = (dateStr: string) => {
    return dayjs(dateStr).format('h:mm A');
  };

  return (
    <Card className="bg-dark-200 border-gray-600 hover:border-primary-500 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20 group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-2xl bg-gradient-to-r ${typeConfig.gradient}`}>
              <TypeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">
                {typeConfig.name} Interview #{interviewNumber}
              </CardTitle>
              <p className="text-gray-400 text-sm">{typeConfig.description}</p>
            </div>
          </div>
          
          {callData.difficulty && (
            <Badge className={`${difficultyConfig[callData.difficulty].color} text-white`}>
              {difficultyConfig[callData.difficulty].text}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status and Score Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{t('interviews.status')}:</span>
            <span className={`capitalize font-medium ${getStatusColor(callData.status)}`}>
              {t(`interviews.status.${callData.status.toLowerCase()}`) || callData.status}
            </span>
          </div>
          
          {callData.score && (
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className={`font-bold ${getScoreColor(callData.score)}`}>
                {callData.score}%
              </span>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-gray-300">{formatDate(callData.startedAt)}</p>
              <p className="text-gray-500 text-xs">{formatTime(callData.startedAt)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-gray-300">{duration} min</p>
              <p className="text-gray-500 text-xs">Duration</p>
            </div>
          </div>
        </div>

        {/* Message Count */}
        {callData.messageCount && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
              <span className="text-gray-300">{callData.messageCount} exchanges</span>
            </div>
          </div>
        )}

        {/* Quick Feedback Preview */}
        {callData.feedback && (
          <div className="bg-dark-100 rounded-2xl p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium text-gray-300">Quick Preview</span>
            </div>
            
            {callData.feedback.strengths.length > 0 && (
              <div className="text-xs text-gray-400 mb-1">
                <span className="text-green-400">Strengths:</span> {callData.feedback.strengths[0]}
              </div>
            )}
            
            {callData.feedback.improvements.length > 0 && (
              <div className="text-xs text-gray-400">
                <span className="text-orange-400">Improve:</span> {callData.feedback.improvements[0]}
              </div>
            )}
          </div>
        )}

        {/* Cost Information */}
        {callData.cost && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Cost:</span>
            <span className="text-primary-400 font-medium">${callData.cost.toFixed(4)}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button asChild className="flex-1 bg-primary-600 hover:bg-primary-700 text-white">
            <Link href={`/call-data/${callData.id}`} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              View Details
            </Link>
          </Button>
          
          {callData.feedback && (
            <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-dark-100">
              <Link href={`/call-data/${callData.id}/feedback`} className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('interviews.feedback')}
              </Link>
            </Button>
          )}
        </div>

        {/* Hover Effect Arrow */}
        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-4 h-4 text-primary-400" />
        </div>
      </CardContent>
    </Card>
  );
}
