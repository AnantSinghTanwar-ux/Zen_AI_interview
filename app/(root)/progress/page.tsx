import { getCurrentUser } from '@/lib/actions/auth.actions';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Flame, Target, Award, Users } from 'lucide-react';

export default async function ProgressPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/sign-in');
  }
  
  return (
    <div className="container mx-auto px-4 py-8 pt-32">
      <div className="space-y-6">
        <div>
          <h1 className="text-black text-2xl font-bold text-black mb-2">Progress Dashboard</h1>
          <p className="text-gray-400">Track your achievements and progress</p>
        </div>

        {/* Level and Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Level</p>
                  <p className="text-3xl font-bold text-black">5</p>
                  <p className="text-xs text-gray-500">850 / 1000 XP</p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full"
                    style={{ width: '85%' }}
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
                  <p className="text-3xl font-bold text-black">7</p>
                  <p className="text-xs text-gray-500">Best: 12 days</p>
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
                  <p className="text-3xl font-bold text-black">2,450</p>
                  <p className="text-xs text-gray-500">Rank #42</p>
                </div>
                <Star className="h-8 w-8 text-primary-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-black">Your Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-black">12</p>
                <p className="text-sm text-gray-400">Total Interviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black">85%</p>
                <p className="text-sm text-gray-400">Average Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black">24h</p>
                <p className="text-sm text-gray-400">Time Practiced</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-black">3</p>
                <p className="text-sm text-gray-400">Badges Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-dark-200 border-gray-600">
            <CardHeader>
              <CardTitle className="text-black flex items-center gap-2">
                <Award className="w-5 h-5" />
                Earned Badges (3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">🎯</div>
                  <h4 className="font-semibold text-black text-sm">First Steps</h4>
                  <p className="text-xs text-gray-400 mt-1">Complete your first interview</p>
                  <Badge className="mt-2 bg-green-600 text-black text-xs">Common</Badge>
                </div>
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">🔥</div>
                  <h4 className="font-semibold text-black text-sm">Hot Streak</h4>
                  <p className="text-xs text-gray-400 mt-1">7 day practice streak</p>
                  <Badge className="mt-2 bg-blue-600 text-black text-xs">Rare</Badge>
                </div>
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">⭐</div>
                  <h4 className="font-semibold text-black text-sm">High Scorer</h4>
                  <p className="text-xs text-gray-400 mt-1">Score above 90%</p>
                  <Badge className="mt-2 bg-yellow-600 text-black text-xs">Epic</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dark-200 border-gray-600">
            <CardHeader>
              <CardTitle className="text-black flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { rank: 1, name: 'Alex Chen', level: 8, points: 4250 },
                  { rank: 2, name: 'Sarah Kim', level: 7, points: 3890 },
                  { rank: 3, name: 'Mike Johnson', level: 6, points: 3120 },
                  { rank: 4, name: 'You', level: 5, points: 2450, isUser: true }
                ].map((user) => (
                  <div 
                    key={user.rank}
                    className={`flex items-center justify-between p-3 rounded-2xl ${
                      user.isUser ? 'bg-[#f5f5f7] border border-primary-600' : 'bg-dark-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        user.rank === 1 ? 'bg-yellow-500 text-black' :
                        user.rank === 2 ? 'bg-gray-400 text-black' :
                        user.rank === 3 ? 'bg-orange-500 text-black' :
                        'bg-dark-200 text-gray-400'
                      }`}>
                        {user.rank}
                      </div>
                      <div>
                        <p className="text-black font-medium">{user.name}</p>
                        <p className="text-sm text-gray-400">Level {user.level}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-black font-semibold">{user.points.toLocaleString()} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-black">Advanced Gamification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-black text-xl font-semibold text-black mb-2">More Features Coming Soon</h3>
              <p className="text-gray-400 mb-4">
                We're building advanced gamification features including more badges, 
                challenges, and personalized achievements.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
