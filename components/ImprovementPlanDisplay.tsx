"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, CheckCircle, Clock, Star, BookOpen, 
  Play, Award, TrendingUp, ArrowRight, RefreshCw,
  Calendar, User, Lightbulb
} from 'lucide-react';
import { improvementPlanService, ImprovementPlan } from '@/services/improvement/improvement-plan.service';
import { useI18n } from '@/components/I18nProvider';

interface ImprovementPlanDisplayProps {
  userId: string;
}

export default function ImprovementPlanDisplay({ userId }: ImprovementPlanDisplayProps) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<ImprovementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, [userId]);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      let userPlan = await improvementPlanService.getUserPlan(userId);
      
      if (!userPlan) {
        // Generate initial plan
        userPlan = await improvementPlanService.generatePersonalizedPlan(userId);
      }
      
      setPlan(userPlan);
    } catch (error) {
      console.error('Error fetching improvement plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    if (!plan?.id) return;
    
    try {
      await improvementPlanService.updateTaskProgress(plan.id, taskId, completed);
      await fetchPlan(); // Refresh plan
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleRegeneratePlan = async () => {
    try {
      setRegenerating(true);
      const newPlan = await improvementPlanService.regeneratePlan(userId);
      setPlan(newPlan);
    } catch (error) {
      console.error('Error regenerating plan:', error);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#f5f5f7]  border border-none rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
          ))}
        </div>
        <div className="h-96 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <Card className="bg-[#f5f5f7]  border border-none shadow-neo">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-black font-bold">Unable to load improvement plan.</p>
            <Button 
              onClick={fetchPlan} 
              className="mt-4 bg-black text-white hover:bg-gray-800 border border-none shadow-neo"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentPhase = plan.phases[plan.currentPhase];
  const completedPhases = plan.phases.slice(0, plan.currentPhase);
  const upcomingPhases = plan.phases.slice(plan.currentPhase + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-black">{plan.title}</h1>
          <p className="text-gray-600 mt-1 font-medium">{plan.description}</p>
        </div>
        <Button 
          onClick={handleRegeneratePlan} 
          variant="outline" 
          className="border border-none text-black font-bold hover:bg-[#f5f5f7]  border border-none shadow-neo active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo transition-all"
          disabled={regenerating}
        >
          {regenerating ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Regenerate Plan
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Overall Progress</p>
                <p className="text-4xl font-black text-black">{plan.progressPercentage}%</p>
                <p className="text-xs font-bold text-gray-500 mt-1">
                  {plan.completedTasks.length} of {plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0)} tasks
                </p>
              </div>
              <div className="p-3 bg-purple-100 border border-none rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-700" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-[#f5f5f7]  border border-none rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-purple-600 h-full transition-all duration-500 border-r-2 border-black"
                  style={{ width: `${plan.progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Current Phase</p>
                <p className="text-4xl font-black text-black">{plan.currentPhase + 1}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">
                  of {plan.phases.length} phases
                </p>
              </div>
              <div className="p-3 bg-green-100 border border-none rounded-full">
                <Target className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Est. Duration</p>
                <p className="text-4xl font-black text-black">{plan.estimatedDuration}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">weeks</p>
              </div>
              <div className="p-3 bg-yellow-100 border border-none rounded-full">
                <Calendar className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Level */}
      <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
        <CardHeader className="bg-[#f5f5f7]  border border-none border-b-2 border-black">
          <CardTitle className="text-black font-black flex items-center gap-2">
            <User className="w-5 h-5" />
            Current Skill Level
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(plan.currentLevel).map(([skill, level]) => (
              <div key={skill} className="text-center group">
                <p className="text-sm font-bold text-gray-600 mb-3 capitalize group-hover:text-black transition-colors">{skill}</p>
                <div className="relative w-20 h-20 mx-auto bg-[#f5f5f7]  border border-none rounded-3xl border border-none overflow-hidden shadow-sm group-hover:shadow-neo transition-all">
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-500 border-t-2 border-black"
                    style={{ height: `${level}%` }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-black bg-[#f5f5f7] px-2 py-0.5 rounded border border-black font-black text-sm ">
                      {level}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Phase Details */}
      {currentPhase && (
        <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
          <CardHeader className="bg-primary/10 border-b-2 border-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-black font-black flex items-center gap-2 text-xl">
                <div className="p-2 bg-primary text-white rounded border border-none">
                   <Play className="w-5 h-5" />
                </div>
                Current Phase: {currentPhase.title}
              </CardTitle>
              <Badge className="bg-green-500 text-white font-bold border border-none px-3 py-1 self-start md:self-auto">
                Active
              </Badge>
            </div>
            <p className="text-gray-600 font-medium mt-2">{currentPhase.description}</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4 text-sm font-bold bg-[#f5f5f7]  border border-none p-3 rounded-2xl border border-none w-fit">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{currentPhase.duration} weeks</span>
                </div>
                <div className="w-px h-4 bg-gray-400"></div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">
                    {currentPhase.tasks.filter(task => task.completed).length}/{currentPhase.tasks.length} tasks
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-black font-black text-lg mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Tasks Checklist
                </h4>
                <div className="space-y-4">
                  {currentPhase.tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-3xl border-2 transition-all ${
                        task.completed 
                          ? 'bg-green-50 border-green-600 shadow-none' 
                          : 'bg-[#f5f5f7]  text-foreground border-black shadow-neo'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <button
                              onClick={() => handleTaskToggle(task.id, !task.completed)}
                              className={`mt-1 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                task.completed
                                  ? 'bg-green-500 border-green-600 text-white'
                                  : 'bg-[#f5f5f7]  text-foreground border-black hover:bg-[#f5f5f7]  border border-none'
                              }`}
                            >
                              {task.completed && <CheckCircle className="w-4 h-4" strokeWidth={3} />}
                            </button>
                            <div className="flex-1">
                              <h5 className={`font-bold text-lg ${task.completed ? 'text-green-700 line-through decoration-2' : 'text-black'}`}>
                                {task.title}
                              </h5>
                              <p className="text-gray-600 text-sm mt-1 font-medium">{task.description}</p>
                              
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <Badge variant="outline" className="text-xs bg-[#f5f5f7]  text-foreground border-black font-bold">
                                  {task.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-[#f5f5f7]  text-foreground border-black font-bold">
                                  {task.difficulty}
                                </Badge>
                                <span className="text-xs font-bold text-gray-500 flex items-center gap-1 bg-[#f5f5f7]  border border-none px-2 py-0.5 rounded border border-gray-300">
                                  <Clock className="w-3 h-3" />
                                  {task.estimatedTime} min
                                </span>
                              </div>

                              {task.resources.length > 0 && (
                                <div className="mt-4 p-3 bg-[#f5f5f7]  border-2 border-blue-200 rounded-2xl">
                                  <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">Resources:</p>
                                  <div className="space-y-2">
                                    {task.resources.map((resource, index) => (
                                      <div key={index} className="flex items-center gap-2 text-sm">
                                        <BookOpen className="w-4 h-4 text-blue-600" />
                                        <a href={resource.url} className="text-blue-700 font-bold hover:underline cursor-pointer">
                                          {resource.title}
                                        </a>
                                        {resource.free && (
                                          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 border-black border h-5">Free</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {task.score && (
                          <div className="flex flex-col items-center justify-center bg-yellow-50 border-2 border-yellow-400 p-2 rounded-2xl">
                            <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                            <span className="text-yellow-800 font-black text-sm">{task.score}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
        <CardHeader className="bg-indigo-50 border-b-2 border-black">
          <CardTitle className="text-black font-black flex items-center gap-2">
            <Target className="w-5 h-5" />
            Target Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-black font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                <span className="w-2 h-8 bg-black rounded-full"></span>
                Primary Goals
              </h4>
              <div className="space-y-3">
                {plan.targetGoals.primary.map((goal, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-[#f5f5f7]  border border-none border-2 border-gray-200 rounded-2xl">
                    <div className="bg-black rounded-full p-1 mt-0.5 shrink-0">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-gray-800 font-bold text-sm leading-tight">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-black font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                 <span className="w-2 h-8 bg-yellow-400 rounded-full border border-black"></span>
                Secondary Goals
              </h4>
              <div className="space-y-3">
                {plan.targetGoals.secondary.map((goal, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
                     <div className="bg-yellow-400 rounded-full p-1 mt-0.5 shrink-0 border border-black">
                      <Lightbulb className="w-3 h-3 text-black" />
                    </div>
                    <span className="text-gray-800 font-bold text-sm leading-tight">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card className="bg-[#f5f5f7]  text-foreground border border-none shadow-neo">
        <CardHeader className="bg-pink-50 border-b-2 border-black">
          <CardTitle className="text-black font-black flex items-center gap-2">
            <Award className="w-5 h-5" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {plan.milestones.map((milestone) => (
              <div 
                key={milestone.id} 
                className={`p-4 rounded-3xl border-2 transition-all ${
                  milestone.completed 
                    ? 'bg-green-50 border-green-600' 
                    : 'bg-[#f5f5f7]  text-foreground border-black shadow-sm'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-2xl border-2 shrink-0 ${
                       milestone.completed ? 'bg-green-100 border-green-600' : 'bg-[#f5f5f7]  border border-none border-black'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-6 h-6 text-green-700" />
                      ) : (
                        <Target className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h5 className={`font-black text-lg ${milestone.completed ? 'text-green-800' : 'text-black'}`}>
                        {milestone.title}
                      </h5>
                      <p className="text-gray-600 text-sm font-medium">{milestone.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Target: {new Date(milestone.targetDate).toLocaleDateString()}
                    </p>
                    {milestone.reward && (
                      <Badge className="bg-yellow-400 text-black border border-none font-bold">
                        +{milestone.reward.value} {milestone.reward.type}
                      </Badge>
                    )}
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
