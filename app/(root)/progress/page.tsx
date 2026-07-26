import { getCurrentUser } from '@/lib/actions/auth.actions';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Flame, Target, Award, Users } from 'lucide-react';
import { callLogService } from '@/services/firebase/call-log.service';

export default async function ProgressPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/sign-in');
  }
  
  const callLogs = await callLogService.getCallLogsByUser(user.id, 100);
  const totalInterviews = callLogs.length;

  // Time practiced
  let timePracticedSeconds = 0;
  callLogs.forEach(log => {
      if (log.duration) {
          timePracticedSeconds += log.duration;
      } else if (log.startedAt && log.endedAt) {
          timePracticedSeconds += Math.round((new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime()) / 1000);
      }
  });
  
  const timePracticedHours = Math.floor(timePracticedSeconds / 3600);
  const timePracticedStr = timePracticedHours > 0 
     ? `${timePracticedHours}h ${Math.floor((timePracticedSeconds % 3600) / 60)}m`
     : `${Math.floor(timePracticedSeconds / 60)}m`;

  // Streak calculation
  let streak = 0;
  const sortedDates = callLogs
     .map(l => new Date(l.startedAt).toISOString().split('T')[0])
     .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
     
  const uniqueDates = [...new Set(sortedDates)];
  if (uniqueDates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      let currentDateObj = new Date(uniqueDates[0]);
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          streak = 1;
          for (let i = 1; i < uniqueDates.length; i++) {
              const prevDateObj = new Date(uniqueDates[i]);
              const diffDays = Math.round((currentDateObj.getTime() - prevDateObj.getTime()) / 86400000);
              if (diffDays === 1) {
                  streak++;
                  currentDateObj = prevDateObj;
              } else {
                  break;
              }
          }
      }
  }

  const bestStreak = Math.max(streak, uniqueDates.length > 0 ? 1 : 0);

  // Level & XP
  const xpPerInterview = 100;
  const totalXP = totalInterviews * xpPerInterview;
  const level = Math.floor(totalXP / 1000) + 1;
  const currentXP = totalXP % 1000;
  const points = totalInterviews * 150 + streak * 20;

  let badgesEarned = 0;
  if (totalInterviews >= 1) badgesEarned++;
  if (streak >= 7) badgesEarned++;
  if (totalInterviews >= 5) badgesEarned++;

  return (
    <div className="container mx-auto px-4 py-8 pt-32">
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-2xl font-bold text-foreground mb-2">Progress Dashboard</h1>
          <p className="text-gray-400">Track your achievements and progress</p>
        </div>

        {/* Level and Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-dark-200 border-gray-600">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Level</p>
                  <p className="text-3xl font-bold text-foreground">{level}</p>
                  <p className="text-xs text-gray-500">{currentXP} / 1000 XP</p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full"
                    style={{ width: `${(currentXP / 1000) * 100}%` }}
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
                  <p className="text-3xl font-bold text-foreground">{streak}</p>
                  <p className="text-xs text-gray-500">Best: {bestStreak} days</p>
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
                  <p className="text-3xl font-bold text-foreground">{points.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Rank #---</p>
                </div>
                <Star className="h-8 w-8 text-primary-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <Card className="bg-dark-200 border-gray-600">
          <CardHeader>
            <CardTitle className="text-foreground">Your Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{totalInterviews}</p>
                <p className="text-sm text-gray-400">Total Interviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">--%</p>
                <p className="text-sm text-gray-400">Average Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{timePracticedStr}</p>
                <p className="text-sm text-gray-400">Time Practiced</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{badgesEarned}</p>
                <p className="text-sm text-gray-400">Badges Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-dark-200 border-gray-600">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Award className="w-5 h-5" />
                Earned Badges ({badgesEarned})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">🎯</div>
                  <h4 className="font-semibold text-foreground text-sm">First Steps</h4>
                  <p className="text-xs text-gray-400 mt-1">Complete your first interview</p>
                  <Badge className="mt-2 bg-green-600 text-black text-xs">Common</Badge>
                </div>
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">🔥</div>
                  <h4 className="font-semibold text-foreground text-sm">Hot Streak</h4>
                  <p className="text-xs text-gray-400 mt-1">7 day practice streak</p>
                  <Badge className="mt-2 bg-blue-600 text-black text-xs">Rare</Badge>
                </div>
                <div className="text-center p-3 bg-dark-100 rounded-2xl border border-gray-600">
                  <div className="text-2xl mb-2">⭐</div>
                  <h4 className="font-semibold text-foreground text-sm">High Scorer</h4>
                  <p className="text-xs text-gray-400 mt-1">Score above 90%</p>
                  <Badge className="mt-2 bg-yellow-600 text-black text-xs">Epic</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-dark-200 border-gray-600">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
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
                  { rank: 4, name: 'You', level: level, points: points, isUser: true }
                ].sort((a,b) => b.points - a.points).map((user, idx) => (
                  <div 
                    key={user.rank}
                    className={`flex items-center justify-between p-3 rounded-2xl ${
                      user.isUser ? 'bg-[#f5f5f7] border border-primary-600' : 'bg-dark-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        idx + 1 === 1 ? 'bg-yellow-500 text-black' :
                        idx + 1 === 2 ? 'bg-gray-400 text-black' :
                        idx + 1 === 3 ? 'bg-orange-500 text-black' :
                        'bg-dark-200 text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">{user.name}</p>
                        <p className="text-sm text-gray-400">Level {user.level}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-semibold">{user.points.toLocaleString()} pts</p>
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
            <CardTitle className="text-foreground">Advanced Gamification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-foreground text-xl font-semibold text-foreground mb-2">More Features Coming Soon</h3>
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
