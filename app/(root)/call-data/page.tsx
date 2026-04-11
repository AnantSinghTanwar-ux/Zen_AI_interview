"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MessageSquare, Briefcase, FileText, ChevronRight } from "lucide-react";

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

function CallDataPage() {
  const [callData, setCallData] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallData = async () => {
      try {
        console.log("Fetching call data...");
        const response = await fetch('/api/vapi/call-data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Call data received:", data);
        
        if (Array.isArray(data)) {
          setCallData(data);
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
      <PageLayout>
        <div className="min-h-screen bg-[#f5f5f7]  text-foreground bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          <div className="p-6 pt-32 max-w-7xl mx-auto">
          <h1 className="text-black text-4xl font-black mb-8 flex items-center gap-2">
            <span className="bg-black text-white px-3 py-1 -skew-x-12 inline-block">Your</span>
            Interviews
          </h1>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-[#f5f5f7]  border border-none rounded-3xl animate-pulse"></div>
             ))}
          </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-[#f5f5f7]  text-foreground bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          <div className="p-6 pt-32 max-w-7xl mx-auto">
          <h1 className="text-4xl font-black text-black mb-8">Your Interviews</h1>
          <div className="bg-[#f5f5f7]  border border-none shadow-neo rounded-3xl p-8 text-center max-w-2xl mx-auto">
            <h2 className="text-red-600 font-black text-2xl mb-2">Error Loading Interviews</h2>
            <p className="text-gray-700 font-medium mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-black text-white px-6 py-3 rounded-2xl font-bold border border-none hover:bg-gray-800 transition-colors shadow-neo"
            >
              Retry
            </button>
          </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-[#f5f5f7]  text-foreground bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
        <div className="p-6 pt-32 max-w-7xl mx-auto">
        <h1 className="text-4xl font-black text-black mb-8 flex items-center gap-3">
          <Briefcase className="w-10 h-10" strokeWidth={2.5} />
           Your Interviews
        </h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {callData.map((call, index, array) => {
          // Calculate interview number from the end (most recent gets highest number)
          const totalInterviews = array.length;
          const interviewNumber = totalInterviews - index;
          
          return (
            <div
              key={call.id}
              className="bg-[#f5f5f7]  text-foreground border border-none rounded-3xl p-6 shadow-neo flex flex-col justify-between h-full"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Badge className="bg-black text-white text-md font-bold border border-none mb-2 hover:bg-black">
                       Interview #{interviewNumber}
                    </Badge>
                     <p className="text-gray-500 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(call.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className={`font-bold border-2 text-xs uppercase px-2 py-1 ${
                    call.status === 'ended' 
                      ? 'bg-green-100 text-green-700 border-green-700' 
                      : 'bg-yellow-100 text-yellow-700 border-yellow-700'
                  }`}>
                    {call.status}
                  </Badge>
                </div>
                
                <div className="space-y-3 mb-6 bg-[#f5f5f7]  border border-none p-4 rounded-2xl border-2 border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                     <span className="text-gray-500 font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Duration
                     </span>
                     <span className="font-bold text-black">
                        {call.endedAt ? (
                           Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 60000) + ' mins'
                        ) : 'Ongoing'}
                     </span>
                  </div>
                   <div className="flex items-center justify-between text-sm">
                     <span className="text-gray-500 font-bold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Messages
                     </span>
                     <span className="font-bold text-black">{call.messageCount || 0}</span>
                  </div>
                  {call.cost && (
                    <div className="flex items-center justify-between text-sm">
                       <span className="text-gray-500 font-bold flex items-center gap-2">
                          API Cost
                       </span>
                       <span className="font-bold text-green-600">${call.cost.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <Link
                  href={`/call-data/${call.id}`}
                  className="flex items-center justify-center gap-2 bg-[#f5f5f7]  text-foreground text-black font-bold py-3 px-4 rounded-2xl border border-none hover:bg-[#f5f5f7]  border border-none transition-colors text-sm shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <FileText className="w-4 h-4" />
                  Details
                </Link>
                <Link
                  href={`/feedback?callId=${call.id}`}
                  className="flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-2xl border border-none hover:bg-primary/90 transition-colors text-sm shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                   Feedback
                   <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {callData.length === 0 && (
        <div className="text-center py-16 bg-[#f5f5f7]  text-foreground border-2 border-dashed border-gray-400 rounded-3xl">
          <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-black font-bold text-xl mb-2">No interviews yet</p>
          <p className="text-gray-500">Start a new interview to populate this list.</p>
        </div>
      )}
        </div>
      </div>
    </PageLayout>
  );
}

export default CallDataPage;