"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import PageLayout from "@/components/PageLayout";
import FeedbackDisplay from "@/components/FeedbackDisplay";
import { User } from "@/types";
import { Clock, MessageSquare, ChevronRight, Activity } from "lucide-react";

// Force dynamic rendering for this page since it uses authentication
export const dynamic = 'force-dynamic';

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  cost?: number;
  messageCount?: number;
  hasArtifact?: boolean;
}

function FeedbackPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [callData, setCallData] = useState<CallData[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  
  // Get callId from URL parameters if provided
  const urlCallId = searchParams.get('callId');

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Check user authentication
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Fetch recent call data
        const response = await fetch('/api/vapi/call-data?limit=10');
        if (response.ok) {
          const calls = await response.json();
          setCallData(calls);

          // If a specific callId is provided in URL, select that call
          if (urlCallId) {
            const targetCall = calls.find((call: CallData) => call.id === urlCallId);
            if (targetCall) {
              setSelectedCall(targetCall);
            }
          } else if (calls.length > 0) {
            // Default to the most recent call
            setSelectedCall(calls[0]);
          }
        }
      } catch (error) {
        console.error("Error initializing feedback page:", error);
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [urlCallId]);

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-[#f5f5f7]  border border-none rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32 flex items-center justify-center">
            <div className="bg-[#f5f5f7]  text-foreground border border-none p-8 rounded-3xl shadow-neo text-center max-w-md">
                <h1 className="text-2xl font-black text-black mb-4">Access Denied</h1>
                <p className="text-gray-600 font-medium font-medium">You must be logged in to view feedback.</p>
            </div>
        </div>
      </PageLayout>
    );
  }

  if (callData.length === 0) {
    return (
      <PageLayout>
        <div className="min-h-screen p-6 pt-32 flex items-center justify-center">
          <div className="text-center py-12 bg-[#f5f5f7]  text-foreground border border-none p-8 rounded-3xl shadow-neo max-w-lg">
            <Activity className="w-16 h-16 mx-auto text-black mb-4" />
            <h1 className="text-3xl font-black text-black mb-4">No Interview Data</h1>
            <p className="text-gray-600 font-medium text-lg">Complete an interview session to see detailed feedback and analytics.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32 max-w-7xl mx-auto">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-black text-black mb-2 flex items-center gap-3">
              <span className="bg-black text-white px-3 py-1 -skew-x-12 inline-block text-3xl">Feedback</span>
              & Analysis
            </h1>
            <p className="text-gray-600 text-lg font-medium border-l-4 border-black pl-4">AI-powered insights from your interview sessions</p>
          </div>

          {/* Call Selection */}
          {callData.length > 1 && (
            <div className="bg-[#f5f5f7]  text-foreground p-6 rounded-3xl border border-none shadow-neo">
              <h3 className="text-black font-black text-xl mb-4 flex items-center gap-2">
                 <Clock className="w-5 h-5" />
                 Interview History
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {callData.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-4 rounded-3xl border-2 text-left transition-all relative group ${
                      selectedCall?.id === call.id
                        ? 'border-black bg-primary text-white shadow-neo translate-x-[-2px] translate-y-[-2px]'
                        : 'border-black bg-[#f5f5f7]  text-foreground hover:bg-[#f5f5f7]  border border-none hover:shadow-neo'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                       <div className={`font-black text-lg ${selectedCall?.id === call.id ? 'text-white' : 'text-black'}`}>
                        {new Date(call.startedAt).toLocaleDateString()}
                      </div>
                      {selectedCall?.id === call.id && <ChevronRight className="w-5 h-5 text-white" />}
                    </div>
                    
                    <div className={`text-sm font-bold flex items-center gap-1 ${selectedCall?.id === call.id ? 'text-white/80' : 'text-gray-500'}`}>
                       <Clock className="w-3 h-3" />
                       {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                     <div className={`text-sm mt-1 font-bold uppercase tracking-wide flex items-center gap-1 ${selectedCall?.id === call.id ? 'text-white/80' : 'text-gray-500'}`}>
                      <Activity className="w-3 h-3" />
                      {call.status}
                    </div>
                    {call.messageCount && (
                      <div className={`text-xs mt-2 font-black flex items-center gap-1 px-2 py-1 rounded w-fit ${selectedCall?.id === call.id ? 'bg-black/20 text-white' : 'bg-[#f5f5f7]  border border-none text-gray-700'}`}>
                        <MessageSquare className="w-3 h-3" />
                        {call.messageCount} msgs
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Display */}
          {selectedCall ? (
            <FeedbackDisplay 
              callId={selectedCall.id}
              userId={user.id}
              callData={selectedCall}
            />
          ) : (
            <div className="text-center py-16 bg-[#f5f5f7]  text-foreground border-2 border-dashed border-gray-400 rounded-3xl">
              <h3 className="text-black text-xl font-bold mb-2">Select an Interview Session</h3>
              <p className="text-gray-500 font-medium">Choose a session to analyze your performance</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// Loading component for Suspense fallback
function FeedbackPageLoading() {
  return (
    <PageLayout>
      <div className="min-h-screen p-6 pt-32">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-[#f5f5f7]  border border-none rounded w-1/3 mb-8"></div>
           <div className="h-64 bg-[#f5f5f7]  border border-none rounded-2xl mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-[#f5f5f7]  border border-none rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackPageLoading />}>
      <FeedbackPageContent />
    </Suspense>
  );
}