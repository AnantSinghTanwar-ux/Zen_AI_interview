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
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-black">Recent Interviews</h2>
           <Skeleton className="h-10 w-24 bg-[#f5f5f7]  border border-none" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#f5f5f7]  text-foreground border border-none rounded-3xl p-5 h-[140px] flex flex-col justify-between shadow-neo">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24 bg-[#f5f5f7] " />
                  <Skeleton className="h-4 w-16 bg-[#f5f5f7] " />
                </div>
                <Skeleton className="h-5 w-16 bg-[#f5f5f7] " />
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <Skeleton className="h-3 w-20 bg-[#f5f5f7] " />
                <Skeleton className="h-3 w-20 bg-[#f5f5f7] " />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4">
           <Skeleton className="h-10 w-40 rounded-full bg-[#f5f5f7]  border border-none" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 mt-8">
        <h2 className="text-3xl font-black text-black">Recent Interviews</h2>
        <div className="bg-[#f5f5f7]  border-2 border-red-600 rounded-2xl p-4 shadow-neo">
          <p className="text-red-700 font-bold">Unable to load recent interviews</p>
        </div>
      </div>
    );
  }

  if (callData.length === 0) {
    return (
      <div className="flex flex-col gap-6 mt-8">
        <h2 className="text-3xl font-black text-black">Recent Interviews</h2>
        <div className="text-center py-8 bg-[#f5f5f7]  text-foreground border border-none rounded-3xl shadow-neo">
          <p className="text-gray-600 font-medium">No interview data available yet</p>
          <Link href="/interview">
            <Button className="mt-4 font-bold border border-none shadow-neo bg-primary text-white hover:bg-primary/90">Start Your First Interview</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 mt-12">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-black">Recent Interviews</h2>
        <Link href="/call-data">
          <Button variant="ghost" className="text-black hover:bg-[#f5f5f7]  border border-none font-bold border-2 border-transparent hover:border-black transition-all">
            View All →
          </Button>
        </Link>
      </div>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {callData.map((call, index, array) => {
          // Calculate interview number from the end (most recent gets highest number)
          const interviewNumber = array.length - index;
          
          return (
            <Link
              key={call.id}
              href={`/call-data/${call.id}`}
              className="bg-[#f5f5f7]  text-foreground border border-none rounded-3xl p-5 shadow-neo cursor-pointer block"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-black font-bold text-lg">Interview {interviewNumber}</h3>
                  <div className="mt-1">
                    <Badge variant="outline" className={`capitalize border-2 font-bold ${call.status === 'ended' ? 'text-green-700 border-green-700 bg-green-100' : 'text-yellow-700 border-yellow-700 bg-yellow-100'}`}>
                      {call.status}
                    </Badge>
                  </div>
                </div>
                {call.cost && (
                  <div className="text-right">
                    <p className="text-primary font-black text-lg">${call.cost.toFixed(4)}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-1 mb-3 text-xs">
                <p className="text-gray-900 font-bold">
                  {new Date(call.startedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-gray-700 font-medium text-xs">
                  {call.messageCount || 0} messages
                </div>
                <div className="text-primary font-bold text-xs">
                  View Details →
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center mt-4">
        <Link href="/call-data">
          <Button className="btn-secondary">View All Interviews</Button>
        </Link>
      </div>
    </div>
  );
}
