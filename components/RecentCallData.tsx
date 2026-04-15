"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

export default function RecentCallData() {
  const [callData, setCallData] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallData = async () => {
      try {
        // Fetch a larger number of calls to calculate total count
        const response = await fetch('/api/vapi/call-data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Only keep the 4 most recent interviews
          setCallData(data.slice(0, 4));
        } else {
          console.error("Expected array but got:", typeof data);
          setError("Invalid data format received");
        }
      } catch (err) {
        console.error('Error fetching call data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch call data');
      } finally {
        setLoading(false);
      }
    };

    fetchCallData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 mt-12">
        <div className="flex justify-between items-center w-full">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Recent Sessions</h2>
           <Skeleton className="h-10 w-24 bg-white/10 rounded-full" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 h-[150px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24 bg-white/10 rounded-md" />
                  <Skeleton className="h-4 w-16 bg-white/10 rounded-md" />
                </div>
                <Skeleton className="h-6 w-16 bg-white/10 rounded-full" />
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <Skeleton className="h-4 w-20 bg-white/10 rounded-md" />
                <Skeleton className="h-4 w-20 bg-white/10 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4">
           <Skeleton className="h-10 w-40 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 mt-12">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Recent Sessions</h2>
        <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-4">
          <p className="text-red-400 font-medium">Unable to load recent sessions: {error}</p>
        </div>
      </div>
    );
  }

  if (callData.length === 0) {
    return (
      <div className="flex flex-col gap-6 mt-12">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Recent Sessions</h2>
        <div className="text-center py-12 glass-card rounded-3xl border border-white/10 border-dashed">
          <p className="text-muted-foreground font-light mb-6">No session data available yet.</p>
          <Link href="/interview">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 py-2.5 h-auto border-none shadow-[0_0_15px_rgba(157,125,249,0.3)] transition-all font-semibold">Start First Session</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 mt-12 animate-stagger-2">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Recent Sessions</h2>
           <p className="text-muted-foreground mt-2">Resume your progress or review feedback.</p>
        </div>
        <Link href="/call-data">
          <Button variant="ghost" className="text-primary hover:text-white hover:bg-white/5 border border-primary/20 hover:border-primary/50 transition-all rounded-full px-6">
            View All
          </Button>
        </Link>
      </div>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {callData.map((call, index, array) => {
          const interviewNumber = array.length - index;
          
          return (
            <Link
              key={call.id}
              href={`/call-data/${call.id}`}
              className="glass-card p-6 cursor-pointer block hover:bg-white/5 group border-white/5 hover:border-primary/30"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-foreground font-semibold text-lg tracking-wide group-hover:text-primary transition-colors">Session #{interviewNumber}</h3>
                  <div className="mt-2">
                    <Badge variant="outline" className={`lowercase font-medium tracking-wider text-xs px-2 py-0.5 border ${call.status === 'ended' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'}`}>
                      {call.status}
                    </Badge>
                  </div>
                </div>
                {call.cost && (
                  <div className="text-right">
                    <p className="text-foreground/50 font-mono text-sm">${call.cost.toFixed(4)}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-1 mb-4 text-xs">
                <p className="text-muted-foreground font-medium flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary/50 rounded-full"></div>
                  {new Date(call.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <div className="text-muted-foreground font-medium text-xs bg-white/5 px-2 py-1 rounded-md border border-white/5">
                  {call.messageCount || 0} messages
                </div>
                <div className="text-primary font-medium text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Analysis →
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center mt-4">
        <Link href="/call-data">
          <Button className="bg-white/5 text-foreground backdrop-blur-lg border border-white/10 rounded-full px-8 py-3 font-medium transition-all duration-300 hover:bg-white/10 hover:border-white/20">View All Sessions</Button>
        </Link>
      </div>
    </div>
  );
}
