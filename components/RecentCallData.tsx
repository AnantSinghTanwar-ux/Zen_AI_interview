"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import PremiumAccessPopup from "@/components/PremiumAccessPopup";
import { StaggerParent, StaggerItem, ScaleCard, FadeUp } from "@/components/motion";

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

interface RecentCallDataProps {
  userId?: string | null;
}

export default function RecentCallData({ userId }: RecentCallDataProps) {
  const [callData, setCallData] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchCallData = async () => {
      if (!userId) {
        setCallData([]);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch a larger number of calls to calculate total count
        const response = await fetch('/api/vapi/call-data', {
          credentials: 'include',
        });

        if (response.status === 401 || response.status === 403) {
          setCallData([]);
          setError(null);
          return;
        }

        if (response.status === 402) {
          const payload = await response.json().catch(() => ({}));
          setPremiumMessage(
            payload?.message ||
              "Premium is required to continue using this Vapi AI feature."
          );
          setShowPremiumPopup(true);
          setCallData([]);
          setError(payload?.message || "Premium subscription required");
          return;
        }

        if (!response.ok) {
          let message = `HTTP error! status: ${response.status}`;
          try {
            const payload = await response.json();
            message = payload?.error || payload?.message || message;
          } catch {
            // Ignore JSON parse errors and keep generic message.
          }
          throw new Error(message);
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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 mt-12">
        <div className="flex justify-between items-center w-full">
          <h2 className="text-3xl font-semibold text-[#EAEAF0]">Recent Sessions</h2>
           <Skeleton className="h-10 w-24 bg-[#1F1F2B] rounded-full" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#111118] border border-[#1F1F2B] rounded-2xl p-6 h-[150px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24 bg-[#1A1A24] rounded-md" />
                  <Skeleton className="h-4 w-16 bg-[#1A1A24] rounded-md" />
                </div>
                <Skeleton className="h-6 w-16 bg-[#1A1A24] rounded-full" />
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <Skeleton className="h-4 w-20 bg-[#1A1A24] rounded-md" />
                <Skeleton className="h-4 w-20 bg-[#1A1A24] rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4">
           <Skeleton className="h-10 w-40 rounded-full bg-[#1F1F2B]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 mt-12">
         <h2 className="text-3xl font-semibold text-[#EAEAF0]">Recent Sessions</h2>
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-2xl p-4">
          <p className="text-[#EF4444] font-medium">Unable to load recent sessions: {error}</p>
        </div>

        <PremiumAccessPopup
          open={showPremiumPopup}
          message={premiumMessage}
          onClose={() => setShowPremiumPopup(false)}
          onActivated={() => {
            setError(null);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  if (callData.length === 0) {
    return (
      <div className="flex flex-col gap-6 mt-12">
         <h2 className="text-3xl font-semibold text-[#EAEAF0]">Recent Sessions</h2>
        <div className="text-center py-12 bg-[#111118] rounded-2xl border border-[#1F1F2B] border-dashed">
          <p className="text-[#9CA3AF] font-light mb-6">
            {userId ? "No session data available yet." : "Sign in to view your recent sessions."}
          </p>
          <Link href={userId ? "/interview" : "/sign-in"}>
            <Button className="btn-primary border-none shadow-[0_4px_14px_rgba(250,204,21,0.2)]">
              {userId ? "Start First Session" : "Sign In"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FadeUp className="flex flex-col gap-8 mt-12">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-semibold text-[#EAEAF0]">Recent Sessions</h2>
           <p className="text-[#9CA3AF] mt-2">Resume your progress or review feedback.</p>
        </div>
        <Link href="/call-data">
          <Button variant="ghost" className="text-[#FACC15] hover:text-black hover:bg-[#FACC15] border border-[#FACC15]/20 hover:border-[#FACC15] transition-all rounded-full px-6">
            View All
          </Button>
        </Link>
      </div>
      
      <StaggerParent className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {callData.map((call, index, array) => {
          const interviewNumber = array.length - index;
          
          return (
            <StaggerItem key={call.id}>
              <ScaleCard>
                <Link
                  href={`/call-data/${call.id}`}
                  className="bg-[#111118] border border-[#1F1F2B] rounded-2xl p-6 cursor-pointer block transition-all duration-300 hover:border-[#FACC15]/50 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] shadow-[0_4px_14px_rgba(0,0,0,0.2)] group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-[#EAEAF0] font-semibold text-lg tracking-wide group-hover:text-[#FACC15] transition-colors">Session #{interviewNumber}</h3>
                      <div className="mt-2">
                        <Badge variant="outline" className={`lowercase font-medium tracking-wider text-xs px-2 py-0.5 border ${call.status === 'ended' ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'}`}>
                          {call.status}
                        </Badge>
                      </div>
                    </div>
                    {call.cost && (
                      <div className="text-right">
                        <p className="text-[#9CA3AF] font-mono text-sm">${call.cost.toFixed(4)}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1 mb-4 text-xs">
                    <div className="text-[#9CA3AF] font-medium flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#A855F7] rounded-full"></div>
                      {new Date(call.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#1F1F2B]">
                    <div className="text-[#9CA3AF] font-medium text-xs bg-[#1A1A24] px-2 py-1 rounded-md border border-[#2A2A3A]">
                      {call.messageCount || 0} messages
                    </div>
                    <div className="text-[#FACC15] font-medium text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Analysis →
                    </div>
                  </div>
                </Link>
              </ScaleCard>
            </StaggerItem>
          );
        })}
      </StaggerParent>

      <div className="flex justify-center mt-4">
        <Link href="/call-data">
          <Button className="btn-secondary">View All Sessions</Button>
        </Link>
      </div>

      <PremiumAccessPopup
        open={showPremiumPopup}
        message={premiumMessage}
        onClose={() => setShowPremiumPopup(false)}
        onActivated={() => {
          setError(null);
          window.location.reload();
        }}
      />
    </FadeUp>
  );
}
