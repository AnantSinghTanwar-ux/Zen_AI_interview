// Improvement Plan Service - Generates personalized learning paths
import { db } from "@/services/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyticsService } from "@/services/analytics/analytics.service";
import { feedbackService } from "@/services/feedback/feedback.service";

export interface ImprovementPlan {
  id?: string;
  userId: string;
  
  // Plan metadata
  title: string;
  description: string;
  estimatedDuration: number; // in weeks
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  // Personalization data
  currentLevel: {
    technical: number;
    communication: number;
    problemSolving: number;
    confidence: number;
  };
  
  targetGoals: {
    primary: string[];
    secondary: string[];
    timeframe: number; // weeks
  };
  
  // Structured plan
  phases: ImprovementPhase[];
  
  // Progress tracking
  completedTasks: string[];
  currentPhase: number;
  progressPercentage: number;
  
  // Milestones and achievements
  milestones: Milestone[];
  
  createdAt: Date;
  updatedAt: Date;
  lastReviewDate?: Date;
}

export interface ImprovementPhase {
  id: string;
  title: string;
  description: string;
  duration: number; // weeks
  order: number;
  
  tasks: ImprovementTask[];
  skills: string[];
  prerequisites: string[];
  
  // Success criteria
  completionCriteria: {
    tasksCompleted: number;
    minimumScore?: number;
    practiceHours?: number;
  };
}

export interface ImprovementTask {
  id: string;
  title: string;
  description: string;
  type: 'practice' | 'study' | 'project' | 'assessment' | 'review';
  estimatedTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  
  resources: TaskResource[];
  completed: boolean;
  completedAt?: Date;
  score?: number;
  
  // Task-specific data
  metadata: {
    interviewType?: string;
    topics?: string[];
    questions?: string[];
    codeExamples?: string[];
  };
}

export interface TaskResource {
  type: 'article' | 'video' | 'course' | 'practice' | 'book' | 'tool';
  title: string;
  url?: string;
  description: string;
  estimatedTime?: number; // minutes
  free: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  completed: boolean;
  completedAt?: Date;
  reward?: {
    type: 'badge' | 'certificate' | 'points';
    value: string | number;
  };
}

class ImprovementPlanService {
  private readonly COLLECTION = 'improvement_plans';
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generatePersonalizedPlan(userId: string, preferences?: {
    focusAreas?: string[];
    timeCommitment?: number; // hours per week
    experienceLevel?: string;
    careerGoals?: string[];
  }): Promise<ImprovementPlan> {
    try {
      // Gather user data
      const [analytics, recentFeedbacks] = await Promise.all([
        analyticsService.getUserAnalytics(userId, 90),
        feedbackService.getUserFeedbacks(userId, 10)
      ]);

      // Analyze performance patterns
      const performanceAnalysis = this.analyzePerformancePatterns(analytics, recentFeedbacks);
      
      // Generate AI-powered plan
      const aiPlan = await this.generateAIPlan(performanceAnalysis, preferences);
      
      // Structure the plan
      const plan: ImprovementPlan = {
        userId,
        title: aiPlan.title,
        description: aiPlan.description,
        estimatedDuration: aiPlan.estimatedDuration,
        difficulty: aiPlan.difficulty,
        currentLevel: performanceAnalysis.currentLevel,
        targetGoals: aiPlan.targetGoals,
        phases: aiPlan.phases,
        completedTasks: [],
        currentPhase: 0,
        progressPercentage: 0,
        milestones: aiPlan.milestones,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      const docRef = await db.collection(this.COLLECTION).add(plan);
      plan.id = docRef.id;

      return plan;
    } catch (error) {
      console.error('Error generating improvement plan:', error);
      throw error;
    }
  }

  private analyzePerformancePatterns(analytics: any, feedbacks: any[]) {
    // Calculate current skill levels
    const currentLevel = {
      technical: analytics.averageScore || 60,
      communication: feedbacks.length > 0 ? 
        feedbacks.reduce((sum, f) => sum + (f.communicationScore || 60), 0) / feedbacks.length : 60,
      problemSolving: feedbacks.length > 0 ? 
        feedbacks.reduce((sum, f) => sum + (f.problemSolvingScore || 60), 0) / feedbacks.length : 60,
      confidence: feedbacks.length > 0 ? 
        feedbacks.reduce((sum, f) => sum + (f.confidenceScore || 60), 0) / feedbacks.length : 60,
    };

    // Identify patterns
    const commonWeaknesses: Record<string, number> = {};
    const commonStrengths: Record<string, number> = {};

    feedbacks.forEach(feedback => {
      feedback.weaknesses?.forEach((weakness: string) => {
        commonWeaknesses[weakness] = (commonWeaknesses[weakness] || 0) + 1;
      });
      feedback.strengths?.forEach((strength: string) => {
        commonStrengths[strength] = (commonStrengths[strength] || 0) + 1;
      });
    });

    // Determine improvement areas
    const priorityAreas = Object.entries(commonWeaknesses)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([area]) => area);

    return {
      currentLevel,
      priorityAreas,
      strengths: Object.keys(commonStrengths),
      interviewHistory: analytics,
      trend: analytics.performanceTrend || [],
    };
  }

  private async generateAIPlan(analysis: any, preferences: any = {}): Promise<any> {
    if (!this.genAI) {
      return this.generateFallbackPlan(analysis, preferences);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const prompt = `
Generate a personalized interview improvement plan based on:

Performance Analysis:
- Current Levels: ${JSON.stringify(analysis.currentLevel)}
- Priority Areas: ${JSON.stringify(analysis.priorityAreas)}
- Strengths: ${JSON.stringify(analysis.strengths)}

User Preferences:
- Focus Areas: ${JSON.stringify(preferences.focusAreas || [])}
- Time Commitment: ${preferences.timeCommitment || 5} hours/week
- Experience Level: ${preferences.experienceLevel || 'intermediate'}
- Career Goals: ${JSON.stringify(preferences.careerGoals || [])}

Create a comprehensive improvement plan in JSON format with:
1. title (engaging plan title)
2. description (2-3 sentence overview)
3. estimatedDuration (weeks)
4. difficulty (beginner/intermediate/advanced)
5. targetGoals (primary and secondary goals with timeframe)
6. phases (3-5 phases, each with tasks)
7. milestones (key checkpoints)

Each phase should have:
- title, description, duration, order
- tasks array with specific actionable items
- skills to develop
- completion criteria

Each task should include:
- title, description, type, estimatedTime, difficulty
- resources with links and descriptions
- specific practice questions or exercises

Focus on practical, actionable steps that address the identified weaknesses.
Return only valid JSON.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating AI plan:', error);
      return this.generateFallbackPlan(analysis, preferences);
    }
  }

  private generateFallbackPlan(analysis: any, preferences: any): any {
    return {
      title: "Comprehensive Interview Improvement Plan",
      description: "A structured 8-week program to enhance your interview performance across all key areas.",
      estimatedDuration: 8,
      difficulty: "intermediate",
      targetGoals: {
        primary: [
          "Improve overall interview score by 20%",
          "Master common behavioral questions",
          "Strengthen technical communication"
        ],
        secondary: [
          "Build confidence in problem-solving",
          "Develop better storytelling skills"
        ],
        timeframe: 8
      },
      phases: [
        {
          id: "phase1",
          title: "Foundation Building",
          description: "Establish core interview skills and assess current abilities",
          duration: 2,
          order: 1,
          tasks: [
            {
              id: "task1",
              title: "Complete STAR Method Training",
              description: "Learn and practice the Situation, Task, Action, Result framework",
              type: "study",
              estimatedTime: 90,
              difficulty: "easy",
              resources: [
                {
                  type: "article",
                  title: "STAR Method Guide",
                  description: "Complete guide to behavioral interview responses",
                  estimatedTime: 30,
                  free: true
                }
              ],
              completed: false,
              metadata: {
                topics: ["behavioral interviews", "storytelling", "structure"]
              }
            }
          ],
          skills: ["structured responses", "self-reflection"],
          prerequisites: [],
          completionCriteria: {
            tasksCompleted: 1,
            minimumScore: 70
          }
        }
      ],
      milestones: [
        {
          id: "milestone1",
          title: "Complete Foundation Phase",
          description: "Successfully complete all foundation building tasks",
          targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          completed: false,
          reward: {
            type: "badge",
            value: "Foundation Master"
          }
        }
      ]
    };
  }

  async getUserPlan(userId: string): Promise<ImprovementPlan | null> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as ImprovementPlan;
    } catch (error) {
      console.error('Error getting user plan:', error);
      throw error;
    }
  }

  async updateTaskProgress(planId: string, taskId: string, completed: boolean, score?: number): Promise<void> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) throw new Error('Plan not found');

      // Update task completion
      plan.phases.forEach(phase => {
        phase.tasks.forEach(task => {
          if (task.id === taskId) {
            task.completed = completed;
            task.completedAt = completed ? new Date() : undefined;
            if (score !== undefined) task.score = score;
          }
        });
      });

      // Update completed tasks list
      if (completed && !plan.completedTasks.includes(taskId)) {
        plan.completedTasks.push(taskId);
      } else if (!completed) {
        plan.completedTasks = plan.completedTasks.filter(id => id !== taskId);
      }

      // Recalculate progress
      const totalTasks = plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
      plan.progressPercentage = Math.round((plan.completedTasks.length / totalTasks) * 100);

      // Update current phase
      let completedPhases = 0;
      for (const phase of plan.phases) {
        const phaseTasks = phase.tasks.length;
        const completedPhaseTasks = phase.tasks.filter(task => task.completed).length;
        
        if (completedPhaseTasks >= phase.completionCriteria.tasksCompleted) {
          completedPhases++;
        } else {
          break;
        }
      }
      plan.currentPhase = Math.min(completedPhases, plan.phases.length - 1);

      plan.updatedAt = new Date();

      await db.collection(this.COLLECTION).doc(planId).set(plan);
    } catch (error) {
      console.error('Error updating task progress:', error);
      throw error;
    }
  }

  async getPlan(planId: string): Promise<ImprovementPlan | null> {
    try {
      const doc = await db.collection(this.COLLECTION).doc(planId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      } as ImprovementPlan;
    } catch (error) {
      console.error('Error getting plan:', error);
      throw error;
    }
  }

  async regeneratePlan(userId: string, preferences?: any): Promise<ImprovementPlan> {
    try {
      // Archive current plan
      const currentPlan = await this.getUserPlan(userId);
      if (currentPlan?.id) {
        await db.collection(this.COLLECTION).doc(currentPlan.id).update({
          archived: true,
          archivedAt: new Date()
        });
      }

      // Generate new plan
      return await this.generatePersonalizedPlan(userId, preferences);
    } catch (error) {
      console.error('Error regenerating plan:', error);
      throw error;
    }
  }
}

export const improvementPlanService = new ImprovementPlanService();
