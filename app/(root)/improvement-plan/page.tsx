import { getCurrentUser } from '@/lib/actions/auth.actions';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, CheckCircle, Clock, Star, BookOpen, Award, TrendingUp } from 'lucide-react';

export default async function ImprovementPlanPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/sign-in');
  }
  
  return (
    <div className="container mx-auto px-4 py-8 pt-32">
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-2xl font-bold text-foreground mb-2">Learning Plan</h1>
          <p className="text-gray-400">Your personalized improvement roadmap</p>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Overall Progress</p>
                  <p className="text-2xl font-bold text-foreground">65%</p>
                  <p className="text-xs text-gray-500">13 of 20 tasks</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary-400" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-primary-400 to-primary-600 h-2 rounded-full"
                    style={{ width: '65%' }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Current Phase</p>
                  <p className="text-2xl font-bold text-foreground">2</p>
                  <p className="text-xs text-gray-500">of 3 phases</p>
                </div>
                <Target className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Est. Duration</p>
                  <p className="text-2xl font-bold text-foreground">4</p>
                  <p className="text-xs text-gray-500">weeks</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Phase */}
        <Card className="bg-dark-200 border-gray-600 border-primary-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-400" />
                Current Phase: Intermediate Problem Solving
              </CardTitle>
              <Badge className="bg-primary-600 text-foreground">Active</Badge>
            </div>
            <p className="text-gray-400">Focus on algorithms and data structures fundamentals</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">2 weeks</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">5/8 tasks</span>
                </div>
              </div>

              <div>
                <h4 className="text-foreground font-semibold mb-3">Tasks</h4>
                <div className="space-y-3">
                  {[
                    { id: 1, title: 'Array and String Problems', completed: true, type: 'Practice', difficulty: 'Easy' },
                    { id: 2, title: 'Linked List Implementation', completed: true, type: 'Study', difficulty: 'Medium' },
                    { id: 3, title: 'Binary Search Variations', completed: true, type: 'Practice', difficulty: 'Medium' },
                    { id: 4, title: 'Tree Traversal Methods', completed: false, type: 'Study', difficulty: 'Medium' },
                    { id: 5, title: 'Dynamic Programming Basics', completed: false, type: 'Practice', difficulty: 'Hard' }
                  ].map((task) => (
                    <div 
                      key={task.id}
                      className={`p-4 rounded-2xl border ${
                        task.completed 
                          ? 'bg-[#f5f5f7] border-green-600' 
                          : 'bg-dark-100 border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                              task.completed
                                ? 'bg-green-600 border-green-600'
                                : 'border-gray-500'
                            }`}>
                              {task.completed && <CheckCircle className="w-3 h-3 text-foreground" />}
                            </div>
                            <div className="flex-1">
                              <h5 className={`font-medium ${
                                task.completed ? 'text-green-400 line-through' : 'text-foreground'
                              }`}>
                                {task.title}
                              </h5>
                              
                              <div className="flex items-center gap-3 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {task.type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {task.difficulty}
                                </Badge>
                                <span className="text-xs text-gray-500">30 min</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {task.completed && (
                          <div className="flex items-center gap-1 ml-4">
                            <Star className="w-4 h-4 text-yellow-400" />
                            <span className="text-yellow-400 font-medium">95%</span>
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

        {/* Goals */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Target className="w-5 h-5" />
              Learning Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-foreground font-semibold mb-3">Short-term Goals</h4>
                <div className="space-y-2">
                  {[
                    'Master basic data structures',
                    'Solve 50 algorithm problems',
                    'Complete mock interviews'
                  ].map((goal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary-400" />
                      <span className="text-gray-300">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-foreground font-semibold mb-3">Long-term Goals</h4>
                <div className="space-y-2">
                  {[
                    'Land a software engineer role',
                    'Achieve 95%+ interview success rate',
                    'Become algorithm expert'
                  ].map((goal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-300">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Award className="w-5 h-5" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: 'Foundation Complete', description: 'Completed basic programming concepts', completed: true, date: '2025-01-15' },
                { title: 'Data Structures Mastery', description: 'Mastered arrays, lists, trees, and graphs', completed: false, date: '2025-02-15' },
                { title: 'Algorithm Expert', description: 'Solved 100+ algorithm problems', completed: false, date: '2025-03-01' }
              ].map((milestone, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-2xl border ${
                    milestone.completed 
                      ? 'bg-[#f5f5f7] border-green-600' 
                      : 'bg-dark-100 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {milestone.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Target className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <h5 className={`font-medium ${
                          milestone.completed ? 'text-green-400' : 'text-foreground'
                        }`}>
                          {milestone.title}
                        </h5>
                        <p className="text-gray-400 text-sm">{milestone.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Target: {milestone.date}</p>
                      {milestone.completed && (
                        <Badge className="mt-1 bg-yellow-600 text-black">
                          +100 XP
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-foreground">AI-Powered Learning Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-foreground text-xl font-semibold text-foreground mb-2">Coming Soon</h3>
              <p className="text-gray-400 mb-4">
                We're building AI-powered personalized learning plans that adapt to your progress 
                and provide customized recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
